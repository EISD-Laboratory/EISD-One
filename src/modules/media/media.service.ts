import { CalendarCategory, MediaRequestStatus } from '@prisma/client';
import { recordAudit, type AuditActor } from '@/core/audit';
import { prisma } from '@/core/db';
import { HttpError } from '@/core/http';

export async function listMediaRequests() {
  return prisma.mediaRequest.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });
}

export async function createMediaRequest(
  input: {
    title: string;
    requesterDivision?: string;
    channel?: string;
    picMemberId?: string;
    picName?: string;
    dueDate?: string;
    publishAt?: string;
    brief?: string;
    assetUrl?: string;
    syncCalendar?: boolean;
  },
  actor: AuditActor,
) {
  let picName = input.picName?.trim() || null;
  if (input.picMemberId && !picName) {
    const member = await prisma.member.findFirst({
      where: { id: input.picMemberId, deletedAt: null },
      select: { fullName: true },
    });
    picName = member?.fullName ?? null;
  }

  const created = await prisma.mediaRequest.create({
    data: {
      title: input.title.trim(),
      requesterDivision: input.requesterDivision?.trim() || null,
      channel: input.channel?.trim() || 'Instagram',
      picMemberId: input.picMemberId || null,
      picName,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      publishAt: input.publishAt ? new Date(input.publishAt) : null,
      status: MediaRequestStatus.REQUESTED,
      brief: input.brief?.trim() || null,
      assetUrl: input.assetUrl?.trim() || null,
      createdBy: actor.id,
    },
  });

  if (input.syncCalendar && created.publishAt) {
    await prisma.calendarItem.create({
      data: {
        title: `[Media] ${created.title} (${created.channel})`,
        description: created.brief,
        category: CalendarCategory.OTHER,
        startAt: created.publishAt,
        endAt: new Date(created.publishAt.getTime() + 60 * 60 * 1000),
        location: created.channel,
        sourceModule: 'media',
        sourceEntityId: created.id,
        createdBy: actor.id,
      },
    });
  }

  await recordAudit({
    actor,
    action: 'media.request.created',
    module: 'media',
    entityType: 'MediaRequest',
    entityId: created.id,
    afterData: created,
  });

  return created;
}

export async function updateMediaRequest(
  id: string,
  input: {
    status?: MediaRequestStatus;
    assetUrl?: string;
    picMemberId?: string;
    picName?: string;
  },
  actor: AuditActor,
) {
  const before = await prisma.mediaRequest.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw new HttpError(404, 'Permintaan Media tidak ditemukan.');

  const updated = await prisma.mediaRequest.update({
    where: { id },
    data: {
      status: input.status ?? before.status,
      assetUrl: input.assetUrl !== undefined ? input.assetUrl.trim() || null : before.assetUrl,
      picMemberId: input.picMemberId !== undefined ? input.picMemberId || null : before.picMemberId,
      picName: input.picName !== undefined ? input.picName.trim() || null : before.picName,
      updatedBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'media.request.updated',
    module: 'media',
    entityType: 'MediaRequest',
    entityId: id,
    beforeData: { status: before.status, assetUrl: before.assetUrl },
    afterData: { status: updated.status, assetUrl: updated.assetUrl },
  });

  return updated;
}
