import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  stripJobColumns, canSeeMoney, JOURNEY_VIEWERS, REWARD_VALUE_ROLES,
} from '../common/roles';
import { computeBadges } from '../common/badges';

// Calendar year of a date, in UTC (capacity weeks and Sales quarters are UTC too).
const yearOf = (d: Date | string) => new Date(d).getUTCFullYear();

function thisMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

@Injectable()
export class MeService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where:   { id: userId },
      include: { person: { select: { id: true, name: true } } },
    });

    const personId = user?.person?.id ?? null;
    const role     = user?.role ?? 'PRODUCER';
    const monday   = thisMonday();
    const nextWeek = addDays(monday, 7);
    const twoWeeks = addDays(monday, 14);

    // ── capacity: this week + next week ──────────────────────────
    const myCapacity = personId
      ? await this.prisma.capacity.findMany({
          where:   { personId, weekStart: { gte: monday, lt: twoWeeks } },
          include: { project: { select: { id: true, name: true, status: true, priority: true, deadline: true, company: true } } },
          orderBy: [{ weekStart: 'asc' }, { pctWeek: 'desc' }],
        })
      : [];

    // ── my projects (PM / PRODUCER / TEAM_LEAD / ADMIN) ─────────────
    let myProjects: any[] = [];
    if (personId && ['PM', 'PRODUCER', 'TEAM_LEAD', 'ADMIN'].includes(role)) {
      const projectFilter =
        role === 'PM'        ? { pmId:       personId } :
        role === 'PRODUCER'  ? { producerId: personId } :
        role === 'TEAM_LEAD' ? { capacityEntries: { some: { personId } } } :
        {};                                               // ADMIN: no scope filter
      const rows = await this.prisma.project.findMany({
        where:   { ...projectFilter, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        include: {
          producer: { select: { id: true, name: true } },
          pm:       { select: { id: true, name: true } },
          // Who's on this project this week
          capacityEntries: {
            where:   { weekStart: { gte: monday, lt: nextWeek } },
            include: { person: { select: { id: true, name: true } } },
            orderBy: { pctWeek: 'desc' },
          },
        },
        orderBy: [{ priority: 'asc' }, { deadline: 'asc' }],
      });
      // Drop the stale money / PPM columns still on the Project table.
      myProjects = rows.map(stripJobColumns);
    }

    // ── active leads (SALES) ──────────────────────────────────────
    const activeLeads = ['SALES', 'ADMIN'].includes(role)
      ? await this.prisma.lead.findMany({
          where:   { status: { notIn: ['WON', 'COMPLETED', 'LOST'] } },
          include: { account: { select: { id: true, name: true } } },
          orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
          take: 15,
        })
      : [];

    // Payment alerts were removed from My Work (Oct 2026) for every role —
    // due / overdue invoices live on the Dashboard and the Financial tab.

    return {
      profile: {
        name:          user?.name,
        role,
        personId,
        hasPersonLink: !!personId,
        personName:    user?.person?.name ?? null,
      },
      myCapacity,
      myProjects,
      activeLeads,
    };
  }

  // ── JOURNEY ──────────────────────────────────────────────────────
  // One person's whole time at the studio, built live from data that
  // already exists — nothing here is stored separately:
  //   • thisYear  — projects, capacity booked, deals closed, awards (Jan 1 → now)
  //   • comingUp  — the next 8 weeks of bookings + projects still running
  //   • years     — one summary per calendar year since they joined
  //   • timeline  — joined, promotions/awards (PersonEvent), committees, deals won
  //   • badges    — auto milestones (src/common/badges.ts)
  //
  // `viewer` is req.user (the JWT payload). `targetPersonId` null = "me".
  async getJourney(viewer: any, targetPersonId: string | null) {
    // The JWT's personId can be stale (a login linked to a Person after the
    // user signed in), so read the link fresh from the DB.
    const viewerUser = await this.prisma.user.findUnique({
      where: { id: viewer.sub }, select: { personId: true, role: true },
    });
    const viewerRole     = viewerUser?.role ?? viewer.role;
    const viewerPersonId = viewerUser?.personId ?? null;

    const personId = targetPersonId ?? viewerPersonId;
    if (!personId) {
      // Logged in, but this account isn't linked to a staff record yet.
      return { linked: false };
    }
    const isSelf = personId === viewerPersonId;
    if (!isSelf && !JOURNEY_VIEWERS.includes(viewerRole)) {
      throw new ForbiddenException('Not available for your role');
    }

    // Money rules (see CLAUDE.md "Money split"):
    //   deal values  → job roles only, even on your own page
    //   reward value → the person themself, ADMIN, FINANCE (like salary)
    const showDealValue   = canSeeMoney(viewerRole);
    const showRewardValue = isSelf || REWARD_VALUE_ROLES.includes(viewerRole);

    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: {
        id: true, name: true, role: true, department: true, company: true,
        startDate: true, status: true,
        skills: { select: { rating: true } },
        events: { orderBy: { eventDate: 'desc' } },
        committeeMembers: {
          select: { role: true, joinedAt: true, leftAt: true, committee: { select: { id: true, name: true } } },
        },
      },
    });
    if (!person) throw new NotFoundException('Person not found');

    const now      = new Date();
    const thisYear = now.getUTCFullYear();
    const monday   = thisMonday();
    const in8Weeks = addDays(monday, 56);

    // Production-only project fields — never money (Project still carries
    // stale money columns, so we pick fields instead of returning whole rows).
    const projectSelect = {
      id: true, name: true, status: true, company: true,
      startDate: true, deadline: true, createdAt: true,
      producerId: true, pmId: true,
    } as const;

    const [capacity, ledProjects, deals] = await Promise.all([
      // Every week they've ever been booked (past and future).
      this.prisma.capacity.findMany({
        where:   { personId },
        select:  { weekStart: true, pctWeek: true, role: true, project: { select: projectSelect } },
        orderBy: { weekStart: 'asc' },
      }),
      // Projects they ran as Producer or PM (they may not be on the capacity board).
      this.prisma.project.findMany({
        where:  { OR: [{ producerId: personId }, { pmId: personId }] },
        select: projectSelect,
      }),
      // Deals they closed. Auto jobs (job_<projectId>) have no closer, so
      // they never show up here — same rule as commission.
      this.prisma.lead.findMany({
        where:   { closedById: personId, status: { in: ['WON', 'COMPLETED'] } },
        select:  {
          id: true, name: true, status: true, wonAt: true, createdAt: true, estimatedValue: true,
          account: { select: { name: true } },
        },
        orderBy: { wonAt: 'desc' },
      }),
    ]);

    // ── per-project rollup ───────────────────────────────────────
    // For each project: which years they touched it, weeks booked per year,
    // and how they were involved (Producer / PM / Team).
    type ProjRoll = {
      project: any; involvement: Set<string>;
      years: Set<number>; weeksByYear: Map<number, number>;
      firstWeek: Date | null; lastWeek: Date | null;
    };
    const rolls = new Map<string, ProjRoll>();
    const roll = (p: any): ProjRoll => {
      let r = rolls.get(p.id);
      if (!r) {
        r = { project: p, involvement: new Set(), years: new Set(), weeksByYear: new Map(), firstWeek: null, lastWeek: null };
        rolls.set(p.id, r);
      }
      return r;
    };

    // Capacity: pctWeek 100 = one full person-week. We add them up as
    // "weeks booked" (50% for 4 weeks = 2 weeks).
    const weekTotals = new Map<string, number>();          // weekStart ISO → total % that week
    for (const c of capacity) {
      const r = roll(c.project);
      r.involvement.add(c.role === 'MAIN' ? 'Main' : 'Support');
      const y = yearOf(c.weekStart);
      if (c.weekStart <= now) {                           // only count weeks that have started
        r.years.add(y);
        r.weeksByYear.set(y, (r.weeksByYear.get(y) ?? 0) + c.pctWeek / 100);
        const k = c.weekStart.toISOString();
        weekTotals.set(k, (weekTotals.get(k) ?? 0) + c.pctWeek);
      }
      if (!r.firstWeek || c.weekStart < r.firstWeek) r.firstWeek = c.weekStart;
      if (!r.lastWeek  || c.weekStart > r.lastWeek)  r.lastWeek  = c.weekStart;
    }
    // Producer / PM projects count in every year from start to deadline
    // (or to today if still open / no deadline).
    for (const p of ledProjects) {
      const r = roll(p);
      if (p.producerId === personId) r.involvement.add('Producer');
      if (p.pmId       === personId) r.involvement.add('PM');
      const from = yearOf(p.startDate ?? p.createdAt);
      const to   = Math.min(thisYear, yearOf(p.deadline ?? now));
      for (let y = from; y <= Math.max(from, to); y++) if (y <= thisYear) r.years.add(y);
    }
    // Cancelled projects aren't part of anyone's body of work.
    const allRolls = [...rolls.values()].filter(r => r.project.status !== 'CANCELLED');

    const projectRow = (r: ProjRoll, year?: number) => ({
      id:          r.project.id,
      name:        r.project.name,
      status:      r.project.status,
      company:     r.project.company,
      deadline:    r.project.deadline,
      involvement: [...r.involvement],
      weeks:       round1(year != null
        ? (r.weeksByYear.get(year) ?? 0)
        : [...r.weeksByYear.values()].reduce((a, b) => a + b, 0)),
    });

    const dealYear = (d: typeof deals[number]) => yearOf(d.wonAt ?? d.createdAt);
    const dealRow  = (d: typeof deals[number]) => ({
      id: d.id, name: d.name, status: d.status, client: d.account?.name ?? null,
      wonAt: d.wonAt ?? d.createdAt,
      ...(showDealValue ? { value: d.estimatedValue ?? null } : {}),
    });
    const sumValue = (ds: typeof deals) => ds.reduce((a, d) => a + (d.estimatedValue ?? 0), 0);

    // PersonEvent rows with the reward amount removed for viewers who
    // mustn't see it (the API is the gate, not the UI).
    const events = person.events.map(e => ({
      id: e.id, type: e.type, title: e.title, note: e.note, eventDate: e.eventDate,
      ...(showRewardValue ? { rewardValue: e.rewardValue } : {}),
    }));
    const awards = events.filter(e => e.type === 'ACHIEVEMENT');

    // ── year-by-year summary ─────────────────────────────────────
    const startYear = yearOf(person.startDate);
    const years: any[] = [];
    for (let y = thisYear; y >= startYear; y--) {
      const yRolls  = allRolls.filter(r => r.years.has(y));
      const yDeals  = deals.filter(d => dealYear(d) === y);
      const yWeeks  = yRolls.reduce((a, r) => a + (r.weeksByYear.get(y) ?? 0), 0);
      const yEvents = events.filter(e => yearOf(e.eventDate) === y);
      years.push({
        year:          y,
        projectCount:  yRolls.length,
        weeksBooked:   round1(yWeeks),
        dealCount:     yDeals.length,
        ...(showDealValue ? { dealValue: sumValue(yDeals) } : {}),
        awardCount:    yEvents.filter(e => e.type === 'ACHIEVEMENT').length,
        projects:      yRolls.map(r => projectRow(r, y)).sort((a, b) => b.weeks - a.weeks),
      });
    }

    // ── this year: extra stats ───────────────────────────────────
    // Average load = mean of each booked week's total % (weeks with no
    // booking at all aren't averaged in — they show as "weeks booked").
    const thisYearWeeks = [...weekTotals.entries()].filter(([k]) => yearOf(k) === thisYear).map(([, v]) => v);
    const avgLoadPct = thisYearWeeks.length
      ? Math.round(thisYearWeeks.reduce((a, b) => a + b, 0) / thisYearWeeks.length)
      : null;
    const thisYearDeals = deals.filter(d => dealYear(d) === thisYear);
    const current = years[0];

    // ── coming up ────────────────────────────────────────────────
    // Next 8 weeks of bookings, grouped by week.
    const upcomingByWeek = new Map<string, { weekStart: Date; totalPct: number; entries: any[] }>();
    for (const c of capacity) {
      if (c.weekStart < monday || c.weekStart >= in8Weeks) continue;
      if (c.project.status === 'CANCELLED') continue;
      const k = c.weekStart.toISOString();
      const w = upcomingByWeek.get(k) ?? { weekStart: c.weekStart, totalPct: 0, entries: [] };
      w.totalPct += c.pctWeek;
      w.entries.push({ projectId: c.project.id, projectName: c.project.name, pct: c.pctWeek, role: c.role });
      upcomingByWeek.set(k, w);
    }
    // Projects still running that they're part of (booked from this week on, or leading).
    const activeProjects = allRolls
      .filter(r => !['DELIVERED', 'CANCELLED'].includes(r.project.status))
      .filter(r => r.involvement.has('Producer') || r.involvement.has('PM') || (r.lastWeek && r.lastWeek >= monday))
      .map(r => projectRow(r))
      .sort((a, b) => (a.deadline ? +new Date(a.deadline) : Infinity) - (b.deadline ? +new Date(b.deadline) : Infinity));

    // ── timeline ─────────────────────────────────────────────────
    const timeline: any[] = [
      { kind: 'JOINED', date: person.startDate, title: 'Joined the studio', note: `${person.role} · ${person.department}` },
      ...events.map(e => ({ kind: e.type, date: e.eventDate, title: e.title, note: e.note, id: e.id,
        ...(showRewardValue && e.rewardValue != null ? { rewardValue: e.rewardValue } : {}) })),
      ...person.committeeMembers.map(m => ({
        kind: 'COMMITTEE', date: m.joinedAt,
        title: `Joined ${m.committee.name}${m.role !== 'MEMBER' ? ` as ${m.role.toLowerCase()}` : ''}`,
        note: m.leftAt ? `Served until ${m.leftAt.toISOString().slice(0, 10)}` : null,
      })),
      ...deals.map(d => ({
        kind: 'DEAL', date: d.wonAt ?? d.createdAt,
        title: `Won ${d.name}`, note: d.account?.name ?? null,
        ...(showDealValue && d.estimatedValue != null ? { value: d.estimatedValue } : {}),
      })),
    ].sort((a, b) => +new Date(b.date) - +new Date(a.date));

    const totalWeeks = allRolls.reduce((a, r) => a + [...r.weeksByYear.values()].reduce((x, y) => x + y, 0), 0);

    return {
      linked: true,
      viewer: { isSelf, showDealValue, showRewardValue },
      person: {
        id: person.id, name: person.name, role: person.role, department: person.department,
        company: person.company, startDate: person.startDate, status: person.status,
      },
      year: thisYear,
      thisYear: {
        projects:    current.projects,
        weeksBooked: current.weeksBooked,
        avgLoadPct,
        deals:       thisYearDeals.map(dealRow),
        ...(showDealValue ? { dealValue: sumValue(thisYearDeals) } : {}),
        awards:      awards.filter(a => yearOf(a.eventDate) === thisYear),
      },
      comingUp: {
        weeks:    [...upcomingByWeek.values()].sort((a, b) => +a.weekStart - +b.weekStart)
                    .map(w => ({ ...w, totalPct: Math.round(w.totalPct) })),
        projects: activeProjects,
      },
      lifetime: {
        tenureDays:   Math.floor((now.getTime() - new Date(person.startDate).getTime()) / 86_400_000),
        projectCount: allRolls.length,
        weeksBooked:  round1(totalWeeks),
        dealCount:    deals.length,
        awardCount:   awards.length,
      },
      years,
      awards,
      timeline,
      badges: computeBadges({
        startDate:      person.startDate,
        skillRatings:   person.skills.map(s => s.rating),
        projectCount:   allRolls.length,
        dealCount:      deals.length,
        committeeCount: person.committeeMembers.length,
        awardCount:     awards.length,
      }),
    };
  }
}

// One decimal place — "12.5 weeks", not "12.499999".
function round1(n: number) { return Math.round(n * 10) / 10; }
