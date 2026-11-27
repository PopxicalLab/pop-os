import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProjectCostDto, UpdateProjectCostDto } from './project-cost.dto';
import { ensureJobForProject } from '../common/job';

// Costs belong to the job (lead), not the project — see src/common/job.ts.
// Each row still carries projectId too until the step-4 cleanup drops it,
// so callers can work from either side: ?projectId=… or ?leadId=….
@Injectable()
export class ProjectCostsService {
  constructor(private prisma: PrismaService) {}

  findAll(projectId?: string, leadId?: string) {
    // By project → look up via the project's job, so costs follow the job.
    const where = leadId    ? { leadId }
                : projectId ? { lead: { projectId } }
                : undefined;
    return this.prisma.projectCost.findMany({ where, orderBy: { createdAt: 'asc' } });
  }

  async create(dto: CreateProjectCostDto) {
    const { projectId, leadId, ...fields } = dto;
    if (!projectId && !leadId) throw new BadRequestException('Give a projectId or a leadId');

    // Work out both ends of the link: job + project.
    let job: { id: string; projectId: string | null };
    if (leadId) {
      const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, projectId: true } });
      if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);
      job = lead;
    } else {
      job = { id: await ensureJobForProject(this.prisma, projectId!), projectId: projectId! };
    }
    // Temporary: a cost row still needs a project until step 4 makes projectId optional.
    if (!job.projectId) {
      throw new BadRequestException('Convert this lead to a project before adding costs.');
    }

    return this.prisma.projectCost.create({
      data: { ...fields, leadId: job.id, projectId: job.projectId },
    });
  }

  async update(id: string, dto: UpdateProjectCostDto) {
    const existing = await this.prisma.projectCost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`ProjectCost ${id} not found`);
    this.refuseIfFromInvoice(existing);
    return this.prisma.projectCost.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const existing = await this.prisma.projectCost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`ProjectCost ${id} not found`);
    this.refuseIfFromInvoice(existing);
    return this.prisma.projectCost.delete({ where: { id } });
  }

  // A cost made from a linked supplier invoice mirrors that invoice — Autocount
  // is the source of truth. Editing it here would just be overwritten by the
  // next sync, so send people to the right place instead.
  private refuseIfFromInvoice(cost: { documentId: string | null }) {
    if (cost.documentId) {
      throw new BadRequestException(
        'This cost comes from a linked supplier invoice. Change the invoice in Autocount and press Sync, or unlink the invoice to remove it.');
    }
  }
}
