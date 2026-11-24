import { ApprovalStatus, KpiFrameworkStatus, KpiSourceType, Prisma } from '@prisma/client';
import { recordAudit } from './audit';
import { type SessionUser } from './auth';
import { prisma } from './db';
import { generateCsvBuffer, generateXlsxBuffer, type SheetColumn } from './excel';
import { HttpError } from './http';

export interface KpiProviderInput {
  memberId: string;
  year: number;
  month: number;
  divisionIds: string[];
}

export interface KpiSourceProvider {
  code: string;
  name: string;
  description: string;
  compute(input: KpiProviderInput): Promise<number>;
}

const kpiProviders = new Map<string, KpiSourceProvider>();

export function registerKpiSourceProvider(provider: KpiSourceProvider): void {
  kpiProviders.set(provider.code, provider);
}

export function listKpiSourceProviders() {
  return Array.from(kpiProviders.values()).map((p) => ({
    code: p.code,
    name: p.name,
    description: p.description,
  }));
}

// Provider bawaan core (modul divisi di Tahap 2 mendaftarkan provider tambahan tanpa mengubah core)
registerKpiSourceProvider({
  code: 'member.profile_completeness',
  name: 'Kelengkapan Data Anggota',
  description: 'Persentase kelengkapan email, tanggal lahir, kontak, dan angkatan (0-100%).',
  compute: async ({ memberId }) => {
    const m = await prisma.member.findUnique({ where: { id: memberId } });
    if (!m) return 0;
    const fields = [m.email, m.birthDate, m.phone, m.batchYear];
    return (fields.filter((f) => f !== null && f !== '').length / fields.length) * 100;
  },
});

registerKpiSourceProvider({
  code: 'calendar.activity_count',
  name: 'Agenda Kegiatan Divisi',
  description: 'Jumlah agenda kalender pada divisi anggota di bulan penilaian.',
  compute: async ({ year, month, divisionIds }) => {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return prisma.calendarItem.count({
      where: {
        deletedAt: null,
        startAt: { gte: start, lt: end },
        OR: [
          { divisionId: null },
          ...(divisionIds.length ? [{ divisionId: { in: divisionIds } }] : []),
        ],
      },
    });
  },
});

/** Normalisasi nilai mentah ke rentang 0-100 sebelum dibobotkan. */
export function normalizeKpiValue(rawValue: number, minScale: number, maxScale: number): number {
  if (maxScale <= minScale) return rawValue >= maxScale ? 100 : 0;
  const clamped = Math.max(0, Math.min(1, (rawValue - minScale) / (maxScale - minScale)));
  return Math.round(clamped * 10000) / 100;
}

/** Validasi bobot indikator harus tepat 100% per cakupan. */
export function validateIndicatorWeights(
  indicators: Array<{ weight: number; targetDivisionId: string | null }>,
): { valid: boolean; reason?: string } {
  if (indicators.length === 0) {
    return { valid: false, reason: 'Framework minimal harus memiliki 1 indikator.' };
  }
  const globalSum = indicators
    .filter((i) => !i.targetDivisionId)
    .reduce((acc, i) => acc + i.weight, 0);

  const divMap = new Map<string, number>();
  for (const ind of indicators) {
    if (ind.targetDivisionId) {
      divMap.set(ind.targetDivisionId, (divMap.get(ind.targetDivisionId) ?? 0) + ind.weight);
    }
  }

  if (divMap.size === 0) {
    if (Math.abs(globalSum - 100) > 0.01) {
      return {
        valid: false,
        reason: `Total bobot harus 100% (saat ini: ${globalSum.toFixed(2)}%).`,
      };
    }
    return { valid: true };
  }

  for (const [divId, sum] of divMap.entries()) {
    if (Math.abs(globalSum + sum - 100) > 0.01) {
      return {
        valid: false,
        reason: `Total bobot untuk divisi ${divId} harus 100% (saat ini: ${(globalSum + sum).toFixed(2)}%).`,
      };
    }
  }
  return { valid: true };
}

export async function activateKpiFramework(frameworkId: string, actor: SessionUser) {
  const fw = await prisma.kpiFramework.findFirst({
    where: { id: frameworkId, deletedAt: null },
    include: { indicators: { where: { deletedAt: null } } },
  });
  if (!fw) throw new HttpError(404, 'Framework KPI tidak ditemukan.');

  const check = validateIndicatorWeights(fw.indicators);
  if (!check.valid) throw new HttpError(400, check.reason ?? 'Bobot tidak valid.');

  const updated = await prisma.kpiFramework.update({
    where: { id: frameworkId },
    data: { status: KpiFrameworkStatus.ACTIVE, updatedBy: actor.id },
  });

  await recordAudit({
    actor,
    action: 'kpi.framework.activated',
    module: 'kpi',
    entityType: 'KpiFramework',
    entityId: frameworkId,
    beforeData: { status: fw.status },
    afterData: { status: updated.status },
  });
  return updated;
}

export async function cloneKpiFramework(frameworkId: string, actor: SessionUser) {
  const src = await prisma.kpiFramework.findFirst({
    where: { id: frameworkId, deletedAt: null },
    include: { indicators: { where: { deletedAt: null } } },
  });
  if (!src) throw new HttpError(404, 'Framework KPI tidak ditemukan.');

  const cloned = await prisma.kpiFramework.create({
    data: {
      name: `${src.name} (v${src.version + 1})`,
      periodId: src.periodId,
      version: src.version + 1,
      status: KpiFrameworkStatus.DRAFT,
      clonedFromId: src.id,
      description: src.description,
      createdBy: actor.id,
      updatedBy: actor.id,
      indicators: {
        create: src.indicators.map((i) => ({
          code: i.code,
          name: i.name,
          description: i.description,
          targetDivisionId: i.targetDivisionId,
          weight: i.weight,
          sourceType: i.sourceType,
          unit: i.unit,
          minScale: i.minScale,
          maxScale: i.maxScale,
          sourceCode: i.sourceCode,
        })),
      },
    },
    include: { indicators: true },
  });

  await recordAudit({
    actor,
    action: 'kpi.framework.cloned',
    module: 'kpi',
    entityType: 'KpiFramework',
    entityId: cloned.id,
    afterData: { clonedFromId: src.id, version: cloned.version },
  });
  return cloned;
}

export async function calculateKpiMonth(
  input: { frameworkId: string; year: number; month: number },
  actor: SessionUser,
) {
  const fw = await prisma.kpiFramework.findFirst({
    where: { id: input.frameworkId, deletedAt: null },
    include: { indicators: { where: { deletedAt: null } } },
  });
  if (!fw) throw new HttpError(404, 'Framework KPI tidak ditemukan.');
  if (fw.status !== KpiFrameworkStatus.ACTIVE) {
    throw new HttpError(400, 'Hanya framework ACTIVE yang dapat dihitung.');
  }

  const members = await prisma.member.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    include: { memberships: { where: { periodId: fw.periodId, deletedAt: null } } },
  });

  for (const member of members) {
    const divisionIds = member.memberships.map((m) => m.divisionId);
    const indicators = fw.indicators.filter(
      (i) => !i.targetDivisionId || divisionIds.includes(i.targetDivisionId),
    );

    let totalWeight = 0;
    let weightedSum = 0;
    const breakdown: Array<Record<string, unknown>> = [];

    for (const ind of indicators) {
      totalWeight += ind.weight;
      if (ind.sourceType === KpiSourceType.AUTO) {
        const provider = ind.sourceCode ? kpiProviders.get(ind.sourceCode) : undefined;
        const rawValue = provider
          ? await provider.compute({
              memberId: member.id,
              year: input.year,
              month: input.month,
              divisionIds,
            })
          : 0;
        const normalizedScore = normalizeKpiValue(rawValue, ind.minScale, ind.maxScale);

        await prisma.kpiScore.upsert({
          where: {
            frameworkId_indicatorId_memberId_year_month: {
              frameworkId: fw.id,
              indicatorId: ind.id,
              memberId: member.id,
              year: input.year,
              month: input.month,
            },
          },
          update: { rawValue, normalizedScore, approvalStatus: ApprovalStatus.APPROVED },
          create: {
            frameworkId: fw.id,
            indicatorId: ind.id,
            memberId: member.id,
            year: input.year,
            month: input.month,
            rawValue,
            normalizedScore,
            sourceType: KpiSourceType.AUTO,
            approvalStatus: ApprovalStatus.APPROVED,
          },
        });

        const weighted = Math.round(((normalizedScore * ind.weight) / 100) * 100) / 100;
        weightedSum += weighted;
        breakdown.push({
          code: ind.code,
          name: ind.name,
          weight: ind.weight,
          rawValue,
          normalizedScore,
          weighted,
        });
      } else {
        const manual = await prisma.kpiScore.findUnique({
          where: {
            frameworkId_indicatorId_memberId_year_month: {
              frameworkId: fw.id,
              indicatorId: ind.id,
              memberId: member.id,
              year: input.year,
              month: input.month,
            },
          },
        });
        const ok = manual?.approvalStatus === ApprovalStatus.APPROVED;
        const normalizedScore = ok ? manual.normalizedScore : 0;
        const weighted = Math.round(((normalizedScore * ind.weight) / 100) * 100) / 100;
        weightedSum += weighted;
        breakdown.push({
          code: ind.code,
          name: ind.name,
          weight: ind.weight,
          rawValue: ok ? manual.rawValue : 0,
          normalizedScore,
          weighted,
          approvalStatus: manual?.approvalStatus ?? 'MISSING',
        });
      }
    }

    const finalScore =
      totalWeight > 0 ? Math.round(((weightedSum * 100) / totalWeight) * 100) / 100 : 0;
    await prisma.kpiResult.upsert({
      where: {
        frameworkId_memberId_year_month: {
          frameworkId: fw.id,
          memberId: member.id,
          year: input.year,
          month: input.month,
        },
      },
      update: {
        finalScore,
        breakdownJson: breakdown as Prisma.InputJsonValue,
        calculatedAt: new Date(),
      },
      create: {
        frameworkId: fw.id,
        memberId: member.id,
        year: input.year,
        month: input.month,
        finalScore,
        breakdownJson: breakdown as Prisma.InputJsonValue,
      },
    });
  }

  await recordAudit({
    actor,
    action: 'kpi.month.recalculated',
    module: 'kpi',
    entityType: 'KpiFramework',
    entityId: fw.id,
    afterData: { year: input.year, month: input.month, membersCalculated: members.length },
  });

  return {
    frameworkId: fw.id,
    year: input.year,
    month: input.month,
    membersCalculated: members.length,
  };
}

export async function listKpiResults(
  params: { frameworkId?: string; year?: number; month?: number },
  actor: SessionUser,
) {
  let frameworkId = params.frameworkId;
  if (!frameworkId) {
    const active = await prisma.kpiFramework.findFirst({
      where: { status: KpiFrameworkStatus.ACTIVE, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    frameworkId = active?.id;
  }
  if (!frameworkId) return [];

  const now = new Date();
  const year = params.year ?? now.getUTCFullYear();
  const month = params.month ?? now.getUTCMonth() + 1;
  const canViewAll = actor.isSuperAdmin || actor.permissions.includes('kpi.result.view_all');

  const rows = await prisma.kpiResult.findMany({
    where: { frameworkId, year, month },
    include: {
      member: {
        include: {
          memberships: { where: { deletedAt: null }, include: { division: true }, take: 3 },
        },
      },
    },
    orderBy: { finalScore: 'desc' },
  });

  return rows
    .map((r, i) => ({
      rank: i + 1,
      id: r.id,
      memberId: r.memberId,
      nim: r.member.nim,
      fullName: r.member.fullName,
      division: r.member.memberships[0]?.division.name ?? '-',
      divisionIds: r.member.memberships.map((m) => m.divisionId),
      year: r.year,
      month: r.month,
      finalScore: r.finalScore,
      isClosed: r.isClosed,
      breakdown: r.breakdownJson,
    }))
    .filter((r) => canViewAll || r.divisionIds.some((d) => actor.divisionIds.includes(d)));
}

const KPI_EXPORT_COLUMNS: SheetColumn[] = [
  { key: 'rank', label: 'Peringkat' },
  { key: 'nim', label: 'NIM' },
  { key: 'fullName', label: 'Nama Anggota' },
  { key: 'division', label: 'Divisi' },
  { key: 'period', label: 'Bulan/Tahun' },
  { key: 'finalScore', label: 'Skor Akhir (0-100)' },
];

export async function exportKpiResultsFile(
  format: 'xlsx' | 'csv',
  params: { frameworkId?: string; year?: number; month?: number },
  actor: SessionUser,
) {
  const results = await listKpiResults(params, actor);
  const rows = results.map((r) => ({
    rank: r.rank,
    nim: r.nim,
    fullName: r.fullName,
    division: r.division,
    period: `${r.year}-${String(r.month).padStart(2, '0')}`,
    finalScore: r.finalScore,
  }));

  await recordAudit({
    actor,
    action: 'kpi.results.exported',
    module: 'kpi',
    entityType: 'KpiResult',
    metadata: { format, rowCount: rows.length, ...params },
  });

  if (format === 'csv') {
    return {
      buffer: generateCsvBuffer(KPI_EXPORT_COLUMNS, rows),
      fileName: 'rekap-kpi.csv',
      contentType: 'text/csv; charset=utf-8',
    };
  }
  return {
    buffer: await generateXlsxBuffer('Rekap KPI Bulanan', KPI_EXPORT_COLUMNS, rows),
    fileName: 'rekap-kpi.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
