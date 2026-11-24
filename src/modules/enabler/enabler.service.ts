import { ApprovalStatus, PartnerStage, Prisma, TransactionType } from '@prisma/client';
import { recordAudit, type AuditActor } from '@/core/audit';
import { type SessionUser } from '@/core/auth';
import { prisma } from '@/core/db';
import { HttpError } from '@/core/http';
import { listKpiResults } from '@/core/kpi';
import { recordCoreTransaction } from '../core/public/index';

export interface PartnerObligation {
  title: string;
  done: boolean;
}

export async function getEnablerOverview(year: number, month: number, actor: SessionUser) {
  const [partners, recognitions, kpiRanking, members] = await Promise.all([
    prisma.enablerPartner.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.enablerRecognition.findMany({
      where: { deletedAt: null },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      take: 30,
    }),
    listKpiResults({ year, month }, actor),
    prisma.member.findMany({
      where: { status: 'ACTIVE', birthDate: { not: null }, deletedAt: null },
      select: { id: true, nim: true, fullName: true, birthDate: true },
    }),
  ]);

  const birthdaysThisMonth = members
    .filter((m) => m.birthDate && m.birthDate.getUTCMonth() + 1 === month)
    .sort((a, b) => (a.birthDate?.getUTCDate() ?? 0) - (b.birthDate?.getUTCDate() ?? 0));

  return {
    partners,
    recognitions,
    kpiRanking: kpiRanking.slice(0, 10),
    birthdaysThisMonth,
  };
}

export async function createPartner(
  input: {
    name: string;
    picName?: string;
    picContact?: string;
    stage: PartnerStage;
    mouExpiresAt?: string;
    obligations?: PartnerObligation[];
    notes?: string;
  },
  actor: AuditActor,
) {
  const created = await prisma.enablerPartner.create({
    data: {
      name: input.name.trim(),
      picName: input.picName?.trim() || null,
      picContact: input.picContact?.trim() || null,
      stage: input.stage,
      mouExpiresAt: input.mouExpiresAt ? new Date(input.mouExpiresAt) : null,
      obligationsJson: (input.obligations ?? []) as unknown as Prisma.InputJsonValue,
      notes: input.notes?.trim() || null,
      createdBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'enabler.partner.created',
    module: 'enabler',
    entityType: 'EnablerPartner',
    entityId: created.id,
    afterData: created,
  });
  return created;
}

export async function updatePartner(
  id: string,
  input: { stage?: PartnerStage; obligations?: PartnerObligation[]; notes?: string },
  actor: AuditActor,
) {
  const before = await prisma.enablerPartner.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw new HttpError(404, 'Partner tidak ditemukan.');

  const updated = await prisma.enablerPartner.update({
    where: { id },
    data: {
      stage: input.stage ?? before.stage,
      obligationsJson:
        input.obligations !== undefined
          ? (input.obligations as unknown as Prisma.InputJsonValue)
          : (before.obligationsJson ?? Prisma.JsonNull),
      notes: input.notes !== undefined ? input.notes : before.notes,
      updatedBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'enabler.partner.updated',
    module: 'enabler',
    entityType: 'EnablerPartner',
    entityId: id,
    beforeData: { stage: before.stage },
    afterData: { stage: updated.stage, obligations: input.obligations },
  });
  return updated;
}

/**
 * Validasi murni untuk aturan Staff of the Month (Bagian 6):
 * Jika pemenang yang dipilih berbeda dari peringkat #1 KPI, override_reason WAJIB diisi.
 */
export function validateStaffOfTheMonthSelection(input: {
  selectedMemberId: string;
  topRankedMemberId: string | null;
  overrideReason?: string;
}): { isOverride: boolean } {
  const isOverride = Boolean(
    input.topRankedMemberId && input.selectedMemberId !== input.topRankedMemberId,
  );
  if (isOverride && (!input.overrideReason || input.overrideReason.trim().length < 5)) {
    throw new HttpError(
      400,
      'Override manual Staff of the Month (bukan peringkat #1 KPI) wajib menyertakan alasan minimal 5 karakter.',
    );
  }
  return { isOverride };
}

export async function proposeRecognition(
  input: {
    year: number;
    month: number;
    memberId: string;
    title?: string;
    overrideReason?: string;
    rewardAmount?: number;
  },
  actor: SessionUser,
) {
  const member = await prisma.member.findFirst({ where: { id: input.memberId, deletedAt: null } });
  if (!member) throw new HttpError(404, 'Anggota tidak ditemukan.');

  const ranking = await listKpiResults({ year: input.year, month: input.month }, actor);
  const top = ranking[0] ?? null;
  const selectedRank = ranking.find((r) => r.memberId === input.memberId);

  const { isOverride } = validateStaffOfTheMonthSelection({
    selectedMemberId: input.memberId,
    topRankedMemberId: top?.memberId ?? null,
    overrideReason: input.overrideReason,
  });

  const created = await prisma.enablerRecognition.create({
    data: {
      year: input.year,
      month: input.month,
      memberId: member.id,
      memberName: member.fullName,
      title: input.title?.trim() || 'Staff of the Month',
      kpiScore: selectedRank?.finalScore ?? 0,
      isOverride,
      overrideReason: isOverride ? input.overrideReason?.trim() : null,
      rewardAmount: Math.round(input.rewardAmount ?? 0),
      status: ApprovalStatus.PENDING,
      createdBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: isOverride ? 'enabler.recognition.proposed_override' : 'enabler.recognition.proposed',
    module: 'enabler',
    entityType: 'EnablerRecognition',
    entityId: created.id,
    afterData: created,
  });

  return created;
}

export async function approveRecognition(id: string, actor: AuditActor) {
  const before = await prisma.enablerRecognition.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw new HttpError(404, 'Data apresiasi tidak ditemukan.');

  const updated = await prisma.enablerRecognition.update({
    where: { id },
    data: { status: ApprovalStatus.APPROVED, approvedBy: actor.id },
  });

  // Integrasi Enabler -> Kas Core: pengeluaran hadiah apresiasi otomatis tercatat
  if (updated.rewardAmount > 0) {
    await recordCoreTransaction({
      type: TransactionType.EXPENSE,
      category: 'Apresiasi Anggota',
      description: `${updated.title} (${updated.year}-${String(updated.month).padStart(2, '0')}): ${updated.memberName}`,
      amount: updated.rewardAmount,
      sourceModule: 'enabler',
      sourceEntityId: updated.id,
      actor,
    });
  }

  await recordAudit({
    actor,
    action: 'enabler.recognition.approved',
    module: 'enabler',
    entityType: 'EnablerRecognition',
    entityId: id,
    beforeData: { status: before.status },
    afterData: { status: updated.status, rewardAmount: updated.rewardAmount },
  });

  return updated;
}
