import { ApprovalStatus, KpiSourceType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/core/audit';
import { requirePermission } from '@/core/auth';
import { prisma } from '@/core/db';
import { handleRouteError, HttpError } from '@/core/http';
import {
  activateKpiFramework,
  calculateKpiMonth,
  cloneKpiFramework,
  listKpiResults,
  listKpiSourceProviders,
  normalizeKpiValue,
} from '@/core/kpi';
import { registerCompetitionKpiProvider } from '@/modules/competition/public/index';
import { registerEventKpiProvider } from '@/modules/event/public/index';
import { registerMediaKpiProvider } from '@/modules/media/public/index';
import { registerPraktikumKpiProvider } from '@/modules/praktikum/public/index';
import { registerResearchKpiProvider } from '@/modules/research/public/index';
import { registerStudyGroupKpiProvider } from '@/modules/study-group/public/index';

registerEventKpiProvider();
registerPraktikumKpiProvider();
registerMediaKpiProvider();
registerCompetitionKpiProvider();
registerResearchKpiProvider();
registerStudyGroupKpiProvider();

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(['kpi.result.read']);
    const sp = req.nextUrl.searchParams;
    const frameworkId = sp.get('frameworkId') || undefined;
    const year = sp.get('year') ? Number(sp.get('year')) : undefined;
    const month = sp.get('month') ? Number(sp.get('month')) : undefined;

    const [frameworks, results, pendingManualScores] = await Promise.all([
      prisma.kpiFramework.findMany({
        where: { deletedAt: null },
        include: { indicators: { where: { deletedAt: null }, orderBy: { code: 'asc' } } },
        orderBy: [{ createdAt: 'desc' }],
      }),
      listKpiResults({ frameworkId, year, month }, user),
      prisma.kpiScore.findMany({
        where: { sourceType: KpiSourceType.MANUAL, approvalStatus: ApprovalStatus.PENDING },
        include: {
          member: { select: { nim: true, fullName: true } },
          indicator: { select: { name: true, minScale: true, maxScale: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      frameworks,
      results,
      pendingManualScores,
      sources: listKpiSourceProviders(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'calculate') {
      const user = await requirePermission(['kpi.framework.manage']);
      const data = z
        .object({
          frameworkId: z.string().uuid(),
          year: z.coerce.number().int(),
          month: z.coerce.number().int().min(1).max(12),
        })
        .parse(body);
      return NextResponse.json(await calculateKpiMonth(data, user));
    }

    if (action === 'activate') {
      const user = await requirePermission(['kpi.framework.manage']);
      const { frameworkId } = z.object({ frameworkId: z.string().uuid() }).parse(body);
      return NextResponse.json(await activateKpiFramework(frameworkId, user));
    }

    if (action === 'clone') {
      const user = await requirePermission(['kpi.framework.manage']);
      const { frameworkId } = z.object({ frameworkId: z.string().uuid() }).parse(body);
      return NextResponse.json(await cloneKpiFramework(frameworkId, user));
    }

    if (action === 'submit_manual') {
      const user = await requirePermission(['kpi.score.submit']);
      const data = z
        .object({
          frameworkId: z.string().uuid(),
          indicatorId: z.string().uuid(),
          memberId: z.string().uuid(),
          year: z.coerce.number().int(),
          month: z.coerce.number().int().min(1).max(12),
          rawValue: z.coerce.number(),
          notes: z.string().optional(),
        })
        .parse(body);

      const ind = await prisma.kpiIndicator.findFirst({
        where: { id: data.indicatorId, frameworkId: data.frameworkId, deletedAt: null },
      });
      if (!ind || ind.sourceType !== KpiSourceType.MANUAL) {
        throw new HttpError(400, 'Indikator manual tidak ditemukan.');
      }
      const normalizedScore = normalizeKpiValue(data.rawValue, ind.minScale, ind.maxScale);
      const saved = await prisma.kpiScore.upsert({
        where: {
          frameworkId_indicatorId_memberId_year_month: {
            frameworkId: data.frameworkId,
            indicatorId: data.indicatorId,
            memberId: data.memberId,
            year: data.year,
            month: data.month,
          },
        },
        update: {
          rawValue: data.rawValue,
          normalizedScore,
          approvalStatus: ApprovalStatus.PENDING,
          submittedBy: user.id,
          notes: data.notes ?? null,
        },
        create: {
          frameworkId: data.frameworkId,
          indicatorId: data.indicatorId,
          memberId: data.memberId,
          year: data.year,
          month: data.month,
          rawValue: data.rawValue,
          normalizedScore,
          sourceType: KpiSourceType.MANUAL,
          approvalStatus: ApprovalStatus.PENDING,
          submittedBy: user.id,
          notes: data.notes ?? null,
        },
      });
      await recordAudit({
        actor: user,
        action: 'kpi.manual.submitted',
        module: 'kpi',
        entityType: 'KpiScore',
        entityId: saved.id,
        afterData: saved,
      });
      return NextResponse.json(saved, { status: 201 });
    }

    if (action === 'decide_manual') {
      const user = await requirePermission(['kpi.score.approve']);
      const data = z
        .object({
          scoreId: z.string().uuid(),
          decision: z.enum(['APPROVED', 'REJECTED']),
        })
        .parse(body);

      const updated = await prisma.kpiScore.update({
        where: { id: data.scoreId },
        data: { approvalStatus: data.decision, approvedBy: user.id },
      });
      await recordAudit({
        actor: user,
        action: `kpi.manual.${data.decision.toLowerCase()}`,
        module: 'kpi',
        entityType: 'KpiScore',
        entityId: data.scoreId,
        afterData: { approvalStatus: updated.approvalStatus },
      });
      return NextResponse.json(updated);
    }

    throw new HttpError(400, 'Action KPI tidak dikenal.');
  } catch (error) {
    return handleRouteError(error);
  }
}
