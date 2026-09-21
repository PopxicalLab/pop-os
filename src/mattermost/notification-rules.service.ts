import {
  BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MattermostService } from './mattermost.service';
import { CreateRuleDto, TargetDto, UpdateRuleDto } from './notification-rules.dto';
import { CAPACITY_SECTIONS, EVENT_CATALOGUE, KL_OFFSET_MS, buildMessage, toKL } from './notification-events';

// How long after its scheduled minute a rule may still fire. This is what makes
// a server restart at 09:00 harmless: when the server comes back at 09:04 it
// sees "the 09:00 slot passed 4 minutes ago and never ran" and sends it.
const GRACE_MS = 60 * 60 * 1000;
const TICK_MS  = 60 * 1000;

// The most recent moment (UTC) at which "day D at HH:mm GMT+8" occurred,
// at or before `now`. Everything in KL time is done on a "shifted" date whose
// UTC fields read as KL wall-clock — see toKL().
export function latestSlot(dayOfWeek: number, timeOfDay: string, now: Date): Date {
  const [hh, mm] = timeOfDay.split(':').map(Number);
  const kl = toKL(now);
  const klIsoDay = kl.getUTCDay() === 0 ? 7 : kl.getUTCDay(); // 1=Mon … 7=Sun
  const slot = new Date(kl);
  slot.setUTCHours(hh, mm, 0, 0);
  slot.setUTCDate(slot.getUTCDate() - ((klIsoDay - dayOfWeek + 7) % 7));
  if (slot.getTime() > kl.getTime()) slot.setUTCDate(slot.getUTCDate() - 7);
  return new Date(slot.getTime() - KL_OFFSET_MS); // back to a real UTC instant
}

@Injectable()
export class NotificationRulesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationRulesService.name);
  private timer: NodeJS.Timeout | null = null;
  // Rules currently being sent — stops an overlapping tick from double-firing.
  private running = new Set<string>();

  constructor(private prisma: PrismaService, private mattermost: MattermostService) {}

  // ── Scheduler ──────────────────────────────────────────────────
  // A plain 1-minute timer instead of @nestjs/schedule: no extra dependency,
  // and "is a rule due?" is decided from DB state (lastRunAt), so it survives
  // restarts. Assumes ONE server process (true for the PM2 setup) — two
  // instances would both fire.
  onModuleInit() {
    if (!this.mattermost.isConfigured()) {
      this.logger.warn('Mattermost not configured (MATTERMOST_URL / _BOT_TOKEN / _TEAM) — scheduled notifications disabled.');
      return;
    }
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref(); // never keep the process alive just for this timer
    setTimeout(() => this.tick(), 15_000).unref(); // catch a slot missed during a restart
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    try {
      const now = new Date();
      const rules = await this.prisma.notificationRule.findMany({
        where: { enabled: true, dayOfWeek: { not: null }, timeOfDay: { not: null } },
        include: { targets: true },
      });
      for (const rule of rules) {
        const slot = latestSlot(rule.dayOfWeek!, rule.timeOfDay!, now);
        const due =
          now.getTime() - slot.getTime() < GRACE_MS &&           // still inside the grace window
          slot > rule.updatedAt &&                                 // slot is after the last edit (a rule saved at 09:30 doesn't fire the 09:00 slot)
          (!rule.lastRunAt || rule.lastRunAt < slot) &&            // not already sent for this slot
          !this.running.has(rule.id);
        if (due) await this.execute(rule);
      }
    } catch (err) {
      this.logger.error(`Scheduler tick failed: ${err.message}`);
    }
  }

  // ── Sending ────────────────────────────────────────────────────
  // Sends `text` to every target of the rule. One bad target doesn't stop the
  // others; failures are collected and returned.
  private async deliver(rule: { targets: any[] }, text: string, users: Map<string, string>) {
    const errors: string[] = [];
    let sent = 0;
    for (const t of rule.targets) {
      try {
        if (t.type === 'CHANNEL') {
          await this.mattermost.sendToChannel(t.channel, text);
        } else {
          await this.mattermost.sendDirect({ username: t.mattermostUsername, email: users.get(t.userId) }, text);
        }
        sent++;
      } catch (err) {
        errors.push(`${t.type === 'CHANNEL' ? '#' + t.channel : users.get(t.userId) || t.userId}: ${err.message}`);
      }
    }
    return { sent, errors };
  }

  private async userEmails(targets: { userId: string | null }[]): Promise<Map<string, string>> {
    const ids = targets.map((t) => t.userId).filter((x): x is string => !!x);
    if (!ids.length) return new Map();
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
    return new Map(users.map((u) => [u.id, u.email]));
  }

  // Build the message, send it, and record the outcome on the rule.
  // Used by both the scheduler and the "Run now" button.
  async execute(rule: { id: string; event: string; company: string | null; options?: unknown; targets: any[] }) {
    this.running.add(rule.id);
    try {
      // Claim the slot BEFORE sending, so a crash mid-send can't cause a double post.
      await this.prisma.notificationRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } });
      let status: string;
      try {
        const text = await buildMessage(this.prisma, rule);
        if (text === null) {
          // The rule chose to stay quiet (e.g. alerts-only and nothing to alert on).
          status = 'OK — nothing to report, no message sent';
        } else {
          const { sent, errors } = await this.deliver(rule, text, await this.userEmails(rule.targets));
          status = errors.length
            ? `Sent to ${sent}/${rule.targets.length} — ${errors.join('; ')}`
            : `OK — sent to ${sent} target(s)`;
          if (errors.length) this.logger.warn(`Rule ${rule.id}: ${status}`);
        }
      } catch (err) {
        status = `Error — ${err.message}`;
        this.logger.error(`Rule ${rule.id}: ${status}`);
      }
      return this.prisma.notificationRule.update({
        where: { id: rule.id },
        data: { lastStatus: status.slice(0, 500) },
        include: { targets: true },
      });
    } finally {
      this.running.delete(rule.id);
    }
  }

  // "Send test" — a short hello to each target, so an admin can check the bot
  // can reach the channel / user without posting a full digest.
  async sendTest(id: string) {
    const rule = await this.findRule(id);
    if (!this.mattermost.isConfigured()) throw new BadRequestException('Mattermost is not configured on the server (.env).');
    const text = `🔔 **Pop OS test message** — rule "${rule.name}". If you can read this, notifications reach you.`;
    const { sent, errors } = await this.deliver(rule, text, await this.userEmails(rule.targets));
    return { sent, total: rule.targets.length, errors };
  }

  async runNow(id: string) {
    const rule = await this.findRule(id);
    if (!this.mattermost.isConfigured()) throw new BadRequestException('Mattermost is not configured on the server (.env).');
    return this.decorate(await this.execute(rule));
  }

  // ── CRUD ───────────────────────────────────────────────────────
  private async findRule(id: string) {
    const rule = await this.prisma.notificationRule.findUnique({ where: { id }, include: { targets: true } });
    if (!rule) throw new NotFoundException('Notification rule not found');
    return rule;
  }

  async list() {
    const rules = await this.prisma.notificationRule.findMany({
      include: { targets: true },
      orderBy: { createdAt: 'asc' },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: rules.flatMap((r) => r.targets.map((t) => t.userId).filter((x): x is string => !!x)) } },
      select: { id: true, name: true },
    });
    const names = new Map(users.map((u) => [u.id, u.name]));
    // Department choices for the capacity filter: the Departments list plus any
    // free-text value already on a Person (Person.department is a plain string).
    const [depts, personDepts] = await Promise.all([
      this.prisma.department.findMany({ select: { name: true } }),
      this.prisma.person.findMany({ distinct: ['department'], select: { department: true } }),
    ]);
    const departments = [...new Set([...depts.map((d) => d.name), ...personDepts.map((p) => p.department)])].sort();
    return {
      configured: this.mattermost.isConfigured(),
      events: EVENT_CATALOGUE,
      capacitySections: CAPACITY_SECTIONS,
      departments,
      rules: rules.map((r) => this.decorate(r, names)),
    };
  }

  // Adds UI helpers: when the rule fires next, and each user target's name.
  private decorate(rule: any, names?: Map<string, string>) {
    const nextRunAt =
      rule.enabled && rule.dayOfWeek && rule.timeOfDay
        ? new Date(latestSlot(rule.dayOfWeek, rule.timeOfDay, new Date()).getTime() + 7 * 86_400_000)
        : null;
    return {
      ...rule,
      nextRunAt,
      targets: rule.targets.map((t: any) => ({ ...t, userName: t.userId ? names?.get(t.userId) ?? null : null })),
    };
  }

  // Rules that can't work are rejected here rather than failing silently at 09:00.
  private validate(event: string, dayOfWeek: number | null | undefined, timeOfDay: string | null | undefined, targets: TargetDto[]) {
    const info = EVENT_CATALOGUE.find((e) => e.key === event);
    if (!info) throw new BadRequestException(`Unknown event "${event}"`);
    if (info.kind === 'SCHEDULED' && (!dayOfWeek || !timeOfDay)) {
      throw new BadRequestException('This event is scheduled — choose a day and time.');
    }
    if (!targets.length) throw new BadRequestException('Add at least one recipient (channel or user).');
    for (const t of targets) {
      if (t.type === 'CHANNEL' && !t.channel?.trim()) throw new BadRequestException('A channel recipient needs a channel name.');
      if (t.type === 'USER' && !t.userId) throw new BadRequestException('A user recipient needs a user.');
    }
  }

  private targetRows(targets: TargetDto[]) {
    return targets.map((t) => ({
      type: t.type,
      channel: t.type === 'CHANNEL' ? t.channel!.trim().replace(/^#/, '').toLowerCase() : null,
      userId: t.type === 'USER' ? t.userId! : null,
      mattermostUsername: t.type === 'USER' ? t.mattermostUsername?.trim().replace(/^@/, '') || null : null,
    }));
  }

  async create(dto: CreateRuleDto) {
    this.validate(dto.event, dto.dayOfWeek, dto.timeOfDay, dto.targets);
    const rule = await this.prisma.notificationRule.create({
      data: {
        name: dto.name,
        event: dto.event,
        enabled: dto.enabled ?? true,
        company: dto.company ?? null,
        dayOfWeek: dto.dayOfWeek ?? null,
        timeOfDay: dto.timeOfDay ?? null,
        ...(dto.options ? { options: { ...dto.options } } : {}),
        targets: { create: this.targetRows(dto.targets) },
      },
      include: { targets: true },
    });
    return this.decorate(rule);
  }

  async update(id: string, dto: UpdateRuleDto) {
    const existing = await this.findRule(id);
    this.validate(
      existing.event,
      dto.dayOfWeek ?? existing.dayOfWeek,
      dto.timeOfDay ?? existing.timeOfDay,
      dto.targets ?? existing.targets.map((t) => ({ type: t.type, channel: t.channel ?? undefined, userId: t.userId ?? undefined })),
    );
    // Nested deleteMany + create inside one update: Prisma runs it as a single
    // transaction, so the rule never ends up with half its targets.
    const rule = await this.prisma.notificationRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.company !== undefined ? { company: dto.company } : {}),
        ...(dto.dayOfWeek !== undefined ? { dayOfWeek: dto.dayOfWeek } : {}),
        ...(dto.timeOfDay !== undefined ? { timeOfDay: dto.timeOfDay } : {}),
        ...(dto.options ? { options: { ...dto.options } } : {}),
        ...(dto.targets ? { targets: { deleteMany: {}, create: this.targetRows(dto.targets) } } : {}),
      },
      include: { targets: true },
    });
    return this.decorate(rule);
  }

  async remove(id: string) {
    const existing = await this.findRule(id);
    await this.prisma.notificationRule.delete({ where: { id } }); // targets cascade
    return existing;
  }
}
