import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface AuditActor {
  id: string;
  name: string;
  role: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // Fire-and-forget — never blocks the calling request.
  // `before` is optional and only meaningful for UPDATE: when given, this
  // computes a field-level diff (old -> new) so the Audit Log can show what
  // actually changed instead of forcing a manual comparison between rows.
  log(actor: AuditActor, action: 'CREATE' | 'UPDATE' | 'DELETE', resource: string, resourceId: string, resourceLabel?: string, after?: any, before?: any): void {
    this.prisma.auditLog.create({
      data: {
        actorId:       actor.id,
        actorName:     actor.name,
        actorRole:     actor.role,
        action:        action as any,
        resource,
        resourceId,
        resourceLabel: resourceLabel ?? null,
        after:         after ? JSON.parse(JSON.stringify(after, bigintReplacer)) : undefined,
        changes:       before && after ? diff(before, after) : undefined,
      },
    }).catch(e => console.error('AuditLog write failed:', e));
  }

  async findAll(filters: {
    resource?:  string;
    action?:    string;
    actorId?:   string;
    startDate?: string;
    endDate?:   string;
    search?:    string;
    page?:      string | number;
  }) {
    const where: any = {};
    if (filters.resource) where.resource = filters.resource;
    if (filters.action)   where.action   = filters.action;
    if (filters.actorId)  where.actorId  = filters.actorId;
    if (filters.search)   where.resourceLabel = { contains: filters.search, mode: 'insensitive' };
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate)   where.createdAt.lte = new Date(filters.endDate + 'T23:59:59.999Z');
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const take = 50;
    const skip = (page - 1) * take;

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ]);

    return { total, page, pages: Math.ceil(total / take), logs };
  }
}

// Prisma returns BigInt for some fields; JSON.stringify chokes on them.
function bigintReplacer(_: string, v: any) {
  return typeof v === 'bigint' ? v.toString() : v;
}

// Top-level field diff between two record snapshots. Skips timestamps
// (always different, never interesting) and returns undefined if nothing changed.
function diff(before: any, after: any): Record<string, { old: any; new: any }> | undefined {
  const changes: Record<string, { old: any; new: any }> = {};
  const skip = new Set(['updatedAt', 'createdAt']);
  for (const key of Object.keys(after)) {
    if (skip.has(key)) continue;
    const oldVal = before[key];
    const newVal = after[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal ?? null, new: newVal ?? null };
    }
  }
  return Object.keys(changes).length ? JSON.parse(JSON.stringify(changes, bigintReplacer)) : undefined;
}
