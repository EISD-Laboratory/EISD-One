import { ResearchStatus, ResearchType } from '@prisma/client';
import { recordAudit, type AuditActor } from '@/core/audit';
import { prisma } from '@/core/db';
import { HttpError } from '@/core/http';

export async function listResearchProjects() {
  return prisma.researchProject.findMany({
    where: { deletedAt: null },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });
}

export async function createResearchProject(
  input: {
    title: string;
    type: ResearchType;
    year: number;
    leadMemberId?: string;
    leadName?: string;
    teamSummary?: string;
    venueOrPartner?: string;
    documentUrl?: string;
    notes?: string;
  },
  actor: AuditActor,
) {
  let leadName = input.leadName?.trim() || null;
  if (input.leadMemberId && !leadName) {
    const member = await prisma.member.findFirst({
      where: { id: input.leadMemberId, deletedAt: null },
      select: { fullName: true },
    });
    leadName = member?.fullName ?? null;
  }

  const created = await prisma.researchProject.create({
    data: {
      title: input.title.trim(),
      type: input.type,
      year: input.year,
      leadMemberId: input.leadMemberId || null,
      leadName,
      teamSummary: input.teamSummary?.trim() || null,
      status: ResearchStatus.PROPOSAL,
      venueOrPartner: input.venueOrPartner?.trim() || null,
      documentUrl: input.documentUrl?.trim() || null,
      notes: input.notes?.trim() || null,
      createdBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'research.project.created',
    module: 'research',
    entityType: 'ResearchProject',
    entityId: created.id,
    afterData: created,
  });

  return created;
}

export async function updateResearchProject(
  id: string,
  input: { status?: ResearchStatus; documentUrl?: string; notes?: string },
  actor: AuditActor,
) {
  const before = await prisma.researchProject.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw new HttpError(404, 'Proyek riset/komunitas tidak ditemukan.');

  const updated = await prisma.researchProject.update({
    where: { id },
    data: {
      status: input.status ?? before.status,
      documentUrl:
        input.documentUrl !== undefined ? input.documentUrl.trim() || null : before.documentUrl,
      notes: input.notes !== undefined ? input.notes.trim() || null : before.notes,
      updatedBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'research.project.updated',
    module: 'research',
    entityType: 'ResearchProject',
    entityId: id,
    beforeData: { status: before.status },
    afterData: { status: updated.status },
  });

  return updated;
}
