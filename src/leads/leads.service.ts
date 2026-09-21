import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateLeadDto, UpdateLeadDto } from './lead.dto';
import { companyWhere } from '../common/company-filter';
import { NotificationRulesService } from '../mattermost/notification-rules.service';

const WITH_RELATIONS = {
  account:  { select: { id: true, name: true, industry: true, autocountDebtorCode: true } },
  contact:  { select: { id: true, name: true, title: true } },
  closedBy: { select: { id: true, name: true } },
  project:  { select: { id: true, name: true, status: true } },
  // Include accounting docs so the lead card can show pushed quotation badges.
  accountingDocuments: {
    select: { id: true, docType: true, docNo: true, docDate: true, dueDate: true, amount: true, status: true },
    orderBy: { docDate: 'desc' as const },
  },
} as const;

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationRulesService,
  ) {}

  findAll(company?: string | null) {
    const co = companyWhere(company);
    return this.prisma.lead.findMany({
      where:   co ?? undefined,
      include: WITH_RELATIONS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id }, include: WITH_RELATIONS });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async create(dto: CreateLeadDto) {
    const created = await this.prisma.lead.create({
      data: {
        name:           dto.name,
        accountId:      dto.accountId      ?? null,
        contactId:      dto.contactId      ?? null,
        status:         dto.status         ?? 'QUALIFICATION',
        priority:       dto.priority       ?? 'MEDIUM',
        estimatedValue: dto.estimatedValue  ?? null,
        invoicedPct:    dto.invoicedPct    ?? 0,
        paidPct:        dto.paidPct        ?? 0,
        paymentDate:    dto.paymentDate    ? new Date(dto.paymentDate) : null,
        completed:      dto.completed      ?? false,
        notes:          dto.notes          ?? null,
        closedById:     dto.closedById     ?? null,
        company:        dto.company        ?? null,
      },
      include: WITH_RELATIONS,
    });

    // Mattermost rules (Admin > Mattermost Notifications). emit() never throws
    // and is deliberately not awaited — the request must not wait on chat.
    void this.notifications.emit('LEAD_CREATED', { lead: created });

    return created;
  }

  async update(id: string, dto: UpdateLeadDto) {
    const current = await this.findOne(id);
    // Record the exact moment a lead becomes WON — used for quarterly commission bucketing.
    const wonAt = dto.status === 'WON' && current.status !== 'WON' ? new Date() : undefined;
    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        ...dto,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
        ...(wonAt ? { wonAt } : {}),
      },
      include: WITH_RELATIONS,
    });

    // Announce a pipeline stage change to Mattermost (fire-and-forget: emit() never
    // throws, and the request must not wait on chat).
    if (dto.status && dto.status !== current.status) {
      void this.notifications.emit('LEAD_STATUS_CHANGED', { lead: updated, from: current.status });
    }

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.lead.delete({ where: { id } });
  }

  // Convert a WON lead into a Project — the key Sales → Production handoff.
  async convertToProject(id: string) {
    const lead = await this.findOne(id);
    if (lead.status !== 'WON') {
      throw new BadRequestException('Only WON leads can be converted to a project.');
    }
    if (lead.projectId) {
      throw new BadRequestException('This lead has already been converted to a project.');
    }

    const project = await this.prisma.project.create({
      data: {
        name:           lead.name,
        client:         lead.account?.name ?? null,
        accountId:      lead.accountId     ?? null,
        quadrant:       'GOLD',   // default — producer should update after review
        priority:       'P2',
        status:         'BRIEF',
        estimatedValue: lead.estimatedValue ?? null,
        // Project.company is required — a lead with no company set becomes a
        // GROUP project rather than blocking the WON -> Production handoff.
        company:        lead.company ?? 'GROUP',
      },
    });

    await this.prisma.lead.update({
      where: { id },
      data:  { projectId: project.id },
    });

    // Any AccountingDocuments created from this lead before conversion are now also
    // linked to the new project so they appear in the project detail view.
    await this.prisma.accountingDocument.updateMany({
      where: { leadId: id, projectId: null },
      data:  { projectId: project.id },
    });

    return project;
  }
}
