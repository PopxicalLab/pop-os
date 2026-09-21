import { PrismaService } from '../prisma.service';

// ── Event catalogue ──────────────────────────────────────────────
// Every event a NotificationRule can listen to. To add a new one:
//   1. add the value to the NotificationEvent enum in schema.prisma (+ migrate)
//   2. add an entry to EVENT_CATALOGUE below
//   3. add a case to buildMessage()
// The Admin screen reads this list from GET /api/notification-rules, so no UI
// change is needed for a plain event. An event with its own settings sets
// `optionsForm` and the UI shows the matching options panel.

// SCHEDULED events fire at a day/time (GMT+8); TRIGGERED events fire when app code
// calls NotificationRulesService.emit(...) — e.g. leads.service.ts on a status change.
export type EventKind = 'SCHEDULED' | 'TRIGGERED';

export interface EventInfo {
  key: string;
  label: string;
  kind: EventKind;
  description: string;
  optionsForm?: 'CAPACITY' | 'LEAD';
}

export const EVENT_CATALOGUE: EventInfo[] = [
  {
    key: 'CAPACITY_WEEKLY',
    label: 'Weekly capacity board',
    kind: 'SCHEDULED',
    description: "Each person's allocation for a week. Choose which sections to include below.",
    optionsForm: 'CAPACITY',
  },
  {
    key: 'LEAD_CREATED',
    label: 'Lead created',
    kind: 'TRIGGERED',
    description: 'Posts when a new lead is added to the Sales pipeline.',
    optionsForm: 'LEAD',
  },
  {
    key: 'LEAD_STATUS_CHANGED',
    label: 'Lead status changed',
    kind: 'TRIGGERED',
    description: 'Posts when a lead moves to another pipeline stage. Choose which stages to be told about.',
    optionsForm: 'LEAD',
  },
];

export const EVENT_KEYS = EVENT_CATALOGUE.map((e) => e.key);

// ── Capacity board options (stored as JSON on the rule) ──────────
export type CapacitySection = 'PER_PERSON' | 'PER_PROJECT' | 'AVAILABLE';

export const CAPACITY_SECTIONS: { key: CapacitySection; label: string; description: string }[] = [
  { key: 'PER_PERSON',  label: 'Per person',       description: "Each person's total % with their project split." },
  { key: 'PER_PROJECT', label: 'Per project',      description: 'Each project with who is on it and the total % committed.' },
  { key: 'AVAILABLE',   label: 'Available people', description: 'People with spare capacity (under 90% booked), most free first.' },
];
export const CAPACITY_SECTION_KEYS = CAPACITY_SECTIONS.map((s) => s.key);

export interface CapacityOptions {
  sections: CapacitySection[];
  week: 'CURRENT' | 'NEXT';
  departments: string[];      // empty = all departments
  includeUnbooked: boolean;   // list active people with nothing booked that week
}

// Rules saved before options existed (options = null) keep the original
// behaviour: per-person table for the current week, booked people only.
export function capacityOptions(raw: unknown): CapacityOptions {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<CapacityOptions>;
  const sections = (o.sections ?? []).filter((s): s is CapacitySection => CAPACITY_SECTION_KEYS.includes(s));
  return {
    sections: sections.length ? sections : ['PER_PERSON'],
    week: o.week === 'NEXT' ? 'NEXT' : 'CURRENT',
    departments: Array.isArray(o.departments) ? o.departments.filter((d) => typeof d === 'string' && d) : [],
    includeUnbooked: o.includeUnbooked === true,
  };
}

// ── Lead event options (stored as JSON on the rule) ──────────────
// Values mirror the LeadStatus enum in schema.prisma.
export const LEAD_STATUSES = ['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'COMPLETED', 'LOST'];

export interface LeadOptions {
  statuses: string[];       // LEAD_STATUS_CHANGED only: which NEW stages notify. Empty = all.
  includeValue: boolean;    // show the estimated value (a channel may be wider than who should see deal sizes)
  mentionCloser: boolean;   // @mention whoever closed the deal, when their Mattermost account can be found
}

export function leadOptions(raw: unknown): LeadOptions {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<LeadOptions>;
  return {
    statuses: Array.isArray(o.statuses) ? o.statuses.filter((s) => LEAD_STATUSES.includes(s)) : [],
    includeValue: o.includeValue !== false,     // default ON
    mentionCloser: o.mentionCloser !== false,   // default ON
  };
}

// Malaysia has no daylight saving, so GMT+8 is a fixed +8 hours. Pop OS stores
// every schedule in this zone and the scheduler converts to it.
export const KL_OFFSET_MS = 8 * 60 * 60 * 1000;

// "Shift" a moment so its UTC fields read as Kuala Lumpur wall-clock time.
// (Trick: after shifting, getUTCHours() etc. return the KL hours.)
export const toKL = (d: Date) => new Date(d.getTime() + KL_OFFSET_MS);

// Monday 00:00 of the week containing d — same rule the Capacity module uses
// for the weekStart it stores, so the query matches. Expects a KL-shifted date.
function mondayOf(d: Date): Date {
  const day  = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  mon.setUTCHours(0, 0, 0, 0);
  return mon;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// Table cells break on "|" — swap it for a look-alike.
const cell = (s: string) => s.replace(/\|/g, '¦');

interface RuleLike { event: string; company: string | null; options?: unknown; }

// Turn a rule into the Markdown message to post. Throws on unknown events.
export async function buildMessage(prisma: PrismaService, rule: RuleLike): Promise<string> {
  switch (rule.event) {
    case 'CAPACITY_WEEKLY': return buildCapacityDigest(prisma, rule);
    default: throw new Error(`No message formatter for event "${rule.event}"`);
  }
}

interface PersonLoad {
  id: string;
  name: string;
  department: string;
  total: number;
  weekend: boolean;               // some of the load is weekend-approved
  projects: { name: string; pct: number }[];
}

async function buildCapacityDigest(prisma: PrismaService, rule: RuleLike): Promise<string> {
  const opts = capacityOptions(rule.options);

  const weekStart = mondayOf(toKL(new Date()));
  if (opts.week === 'NEXT') weekStart.setUTCDate(weekStart.getUTCDate() + 7);

  // Scope is by PERSON, not by project: an LPS person working on a PXL project
  // must still show their full load, otherwise they'd look under-booked.
  // GROUP-tagged and untagged people always show, like the company header filter.
  const and: object[] = [];
  if (rule.company && rule.company !== 'GROUP') {
    and.push({ OR: [{ company: rule.company }, { company: 'GROUP' }, { company: null }] });
  }
  if (opts.departments.length) and.push({ department: { in: opts.departments } });
  const personWhere = and.length ? { AND: and } : {};

  const [rows, unbookedPeople] = await Promise.all([
    prisma.capacity.findMany({
      where: { weekStart, person: personWhere },
      include: {
        person:  { select: { id: true, name: true, department: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ pctWeek: 'desc' }],
    }),
    opts.includeUnbooked
      ? prisma.person.findMany({
          where: { ...personWhere, status: 'ACTIVE', capacityEntries: { none: { weekStart } } },
          select: { id: true, name: true, department: true },
        })
      : Promise.resolve([] as { id: string; name: string; department: string }[]),
  ]);

  // ── Regroup the flat rows ────────────────────────────────────
  const loads = new Map<string, PersonLoad>();
  const projects = new Map<string, { name: string; total: number; people: string[] }>();
  for (const r of rows) {
    const p = loads.get(r.person.id) ?? { id: r.person.id, name: r.person.name, department: r.person.department, total: 0, weekend: false, projects: [] };
    p.total += r.pctWeek;
    p.weekend = p.weekend || r.weekendApproved;
    p.projects.push({ name: r.project.name, pct: r.pctWeek });
    loads.set(p.id, p);

    const pr = projects.get(r.project.id) ?? { name: r.project.name, total: 0, people: [] };
    pr.total += r.pctWeek;
    pr.people.push(`${cell(r.person.name)} ${r.pctWeek}%`);
    projects.set(r.project.id, pr);
  }
  for (const u of unbookedPeople) {
    loads.set(u.id, { id: u.id, name: u.name, department: u.department, total: 0, weekend: false, projects: [] });
  }
  const people = [...loads.values()].sort((a, b) => a.name.localeCompare(b.name));

  const over       = people.filter((p) => p.total > 100);
  const free       = people.filter((p) => p.total < 90).sort((a, b) => a.total - b.total);
  const flag = (p: PersonLoad) =>
    p.total > 100 ? (p.weekend ? '🟠 weekend' : '🔴 over')
    : p.total < 90 ? `🟡 ${Math.round(100 - p.total)}% free`
    : '✅';

  // ── Compose the selected sections (fixed order) ──────────────
  const has = (s: CapacitySection) => opts.sections.includes(s);
  const scope = [rule.company, opts.departments.join(', ')].filter(Boolean).join(' · ');
  const title = `#### 📅 Capacity board — ${opts.week === 'NEXT' ? 'next week, ' : 'week '}of ${fmtDate(weekStart)}${scope ? ` (${scope})` : ''}`;
  const out: string[] = [title, ''];

  if (!people.length) return `${title}\n\nNo allocations booked for this week.`;

  if (has('PER_PERSON')) {
    out.push('**By person**', '', '| Person | Total | Projects |', '|:--|:--|:--|');
    for (const p of people) {
      const split = p.projects.length ? p.projects.map((x) => `${cell(x.name)} ${x.pct}%`).join(' · ') : '—';
      out.push(`| ${cell(p.name)} | ${p.total}% ${flag(p)} | ${split} |`);
    }
    out.push('');
  }

  if (has('PER_PROJECT')) {
    out.push('**By project**');
    if (!projects.size) {
      out.push('No projects have bookings this week.');
    } else {
      out.push('', '| Project | Total | People |', '|:--|:--|:--|');
      for (const pr of [...projects.values()].sort((a, b) => b.total - a.total)) {
        out.push(`| ${cell(pr.name)} | ${pr.total}% (${(pr.total / 100).toFixed(1)} FTE) | ${pr.people.join(' · ')} |`);
      }
    }
    out.push('');
  }

  if (has('AVAILABLE')) {
    out.push('**Available capacity**');
    if (!free.length) {
      out.push('Everyone is 90% or more booked.');
    } else {
      out.push('', '| Person | Free | Department |', '|:--|:--|:--|');
      for (const p of free) out.push(`| ${cell(p.name)} | ${Math.round(100 - p.total)}% | ${cell(p.department)} |`);
    }
    out.push('');
  }

  const avg = Math.round(people.reduce((s, p) => s + p.total, 0) / people.length);
  out.push(`**${people.length} people** · avg ${avg}% · ${over.length} over-allocated · ${free.length} with free capacity`);
  const appUrl = process.env.APP_URL || 'http://192.168.1.40:3000';
  out.push(`[Open the capacity board](${appUrl}/capacity.html)`);
  return out.join('\n');
}

// ── Triggered events: leads ──────────────────────────────────────
// What leads.service.ts hands to NotificationRulesService.emit().
export interface LeadEventPayload {
  lead: {
    name: string;
    status: string;
    company: string | null;
    estimatedValue: number | null;
    account: { name: string } | null;
    closedById: string | null;
  };
  from?: string; // LEAD_STATUS_CHANGED: the stage it moved away from
}

// Does this rule want this event? Applies the rule's company scope and, for
// status changes, its stage filter.
export function leadRuleMatches(
  rule: { company: string | null; options?: unknown },
  event: string,
  payload: LeadEventPayload,
): boolean {
  // Same rule as the header company filter: a Group-tagged or untagged lead
  // matches every company scope.
  const c = payload.lead.company;
  if (rule.company && rule.company !== 'GROUP' && c && c !== 'GROUP' && c !== rule.company) return false;
  if (event === 'LEAD_STATUS_CHANGED') {
    const { statuses } = leadOptions(rule.options);
    if (statuses.length && !statuses.includes(payload.lead.status)) return false;
  }
  return true;
}

// Escape Markdown characters so a lead called "Q3 *rush* [draft]" can't reformat the message.
const MD_SPECIAL = /[\\`*_[\]<>~|]/g;
const md = (s: string) => s.replace(MD_SPECIAL, (ch) => '\\' + ch);
const stageLabel = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const STAGE_EMOJI: Record<string, string> = { WON: '🎉', COMPLETED: '✅', LOST: '❌' };

// `closer` is what to print for "Closed by" (null = omit the line). The caller
// picks "@username" (pings them) or a plain name, based on opts.mentionCloser.
export function buildLeadMessage(
  event: string,
  payload: LeadEventPayload,
  opts: LeadOptions,
  closer: string | null,
): string {
  const { lead } = payload;
  const appUrl = process.env.APP_URL || 'http://192.168.1.40:3000';
  const account = lead.account?.name ? ` (${md(lead.account.name)})` : '';
  const value = opts.includeValue && lead.estimatedValue ? `Est. value: RM ${lead.estimatedValue.toLocaleString('en-MY')}` : null;
  const link = `[Open the sales pipeline](${appUrl}/sales.html)`;

  if (event === 'LEAD_CREATED') {
    return [`🆕 **New lead** — ${md(lead.name)}${account}`, `Stage: ${stageLabel(lead.status)}`, value, link]
      .filter(Boolean).join('\n');
  }
  if (event === 'LEAD_STATUS_CHANGED') {
    const emoji = STAGE_EMOJI[lead.status] ?? '📊';
    return [
      `${emoji} **Lead status changed** — ${md(lead.name)}${account}`,
      `${stageLabel(payload.from ?? '?')} → **${stageLabel(lead.status)}**`,
      value,
      closer ? `Closed by: ${closer}` : null,
      link,
    ].filter(Boolean).join('\n');
  }
  throw new Error(`No lead formatter for event "${event}"`);
}

// Realistic-looking data for the "Send test" button on triggered rules.
export function samplePayload(event: string): LeadEventPayload {
  return {
    lead: { name: 'Sample lead', status: event === 'LEAD_CREATED' ? 'QUALIFICATION' : 'WON', company: null, estimatedValue: 25000, account: { name: 'Sample Client' }, closedById: null },
    from: 'NEGOTIATION',
  };
}
