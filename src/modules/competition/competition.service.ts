import { CalendarCategory, CompetitionStatus, Prisma, TransactionType } from '@prisma/client';
import { recordAudit, type AuditActor } from '@/core/audit';
import { prisma } from '@/core/db';
import { HttpError } from '@/core/http';
import { recordCoreTransaction } from '../core/public/index';

export async function listCompetitionEntries() {
  return prisma.competitionEntry.findMany({
    where: { deletedAt: null },
    orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });
}

export async function createCompetitionEntry(
  input: {
    competitionName: string;
    organizer?: string;
    level?: string;
    teamName: string;
    memberIds?: string[];
    memberNames?: string;
    eventDate: string;
    registrationFee?: number;
    recordToCash?: boolean;
    syncCalendar?: boolean;
    notes?: string;
  },
  actor: AuditActor,
) {
  const memberIds = (input.memberIds ?? []).filter(Boolean);
  let memberNames = input.memberNames?.trim() || null;
  if (memberIds.length > 0 && !memberNames) {
    const members = await prisma.member.findMany({
      where: { id: { in: memberIds }, deletedAt: null },
      select: { fullName: true },
    });
    memberNames = members.map((m) => m.fullName).join(', ');
  }

  const fee = Math.max(0, Math.round(input.registrationFee ?? 0));
  const eventDate = new Date(input.eventDate);

  const created = await prisma.competitionEntry.create({
    data: {
      competitionName: input.competitionName.trim(),
      organizer: input.organizer?.trim() || null,
      level: input.level?.trim() || 'Nasional',
      teamName: input.teamName.trim(),
      memberIdsJson: memberIds as unknown as Prisma.InputJsonValue,
      memberNames,
      eventDate,
      status: CompetitionStatus.REGISTERED,
      registrationFee: fee,
      recordedToCash: Boolean(input.recordToCash && fee > 0),
      notes: input.notes?.trim() || null,
      createdBy: actor.id,
    },
  });

  if (input.syncCalendar !== false) {
    await prisma.calendarItem.create({
      data: {
        title: `[Lomba] ${created.competitionName} — Tim ${created.teamName}`,
        description: created.notes,
        category: CalendarCategory.COMPETITION,
        startAt: eventDate,
        endAt: new Date(eventDate.getTime() + 4 * 60 * 60 * 1000),
        allDay: true,
        location: created.organizer,
        sourceModule: 'competition',
        sourceEntityId: created.id,
        createdBy: actor.id,
      },
    });
  }

  if (input.recordToCash && fee > 0) {
    await recordCoreTransaction({
      type: TransactionType.EXPENSE,
      category: 'Biaya Lomba',
      description: `Pendaftaran lomba ${created.competitionName} (Tim ${created.teamName})`,
      amount: fee,
      sourceModule: 'competition',
      sourceEntityId: created.id,
      actor,
    });
  }

  await recordAudit({
    actor,
    action: 'competition.entry.created',
    module: 'competition',
    entityType: 'CompetitionEntry',
    entityId: created.id,
    afterData: created,
  });

  return created;
}

export async function updateCompetitionEntry(
  id: string,
  input: {
    status?: CompetitionStatus;
    achievement?: string;
    recordToCash?: boolean;
  },
  actor: AuditActor,
) {
  const before = await prisma.competitionEntry.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw new HttpError(404, 'Data lomba tidak ditemukan.');

  let recordedToCash = before.recordedToCash;
  if (input.recordToCash && !before.recordedToCash && before.registrationFee > 0) {
    await recordCoreTransaction({
      type: TransactionType.EXPENSE,
      category: 'Biaya Lomba',
      description: `Pendaftaran lomba ${before.competitionName} (Tim ${before.teamName})`,
      amount: before.registrationFee,
      sourceModule: 'competition',
      sourceEntityId: before.id,
      actor,
    });
    recordedToCash = true;
  }

  const updated = await prisma.competitionEntry.update({
    where: { id },
    data: {
      status: input.status ?? before.status,
      achievement:
        input.achievement !== undefined ? input.achievement.trim() || null : before.achievement,
      recordedToCash,
      updatedBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'competition.entry.updated',
    module: 'competition',
    entityType: 'CompetitionEntry',
    entityId: id,
    beforeData: { status: before.status, achievement: before.achievement },
    afterData: { status: updated.status, achievement: updated.achievement },
  });

  return updated;
}
