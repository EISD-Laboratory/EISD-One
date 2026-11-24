import { ResearchStatus, ResearchType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/core/auth';
import { handleRouteError, HttpError } from '@/core/http';
import {
  createResearchProject,
  listResearchProjects,
  updateResearchProject,
} from '@/modules/research/research.service';

export async function GET() {
  try {
    await requirePermission(['research.project.read']);
    return NextResponse.json(await listResearchProjects());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(['research.project.manage']);
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || 'create');

    if (action === 'create') {
      const data = z
        .object({
          title: z.string().min(3),
          type: z.nativeEnum(ResearchType).default(ResearchType.RESEARCH),
          year: z.coerce.number().int().min(2000).max(2100),
          leadMemberId: z.string().uuid().optional().or(z.literal('')),
          leadName: z.string().optional(),
          teamSummary: z.string().optional(),
          venueOrPartner: z.string().optional(),
          documentUrl: z.string().optional(),
          notes: z.string().optional(),
        })
        .parse(body);
      return NextResponse.json(
        await createResearchProject(
          { ...data, leadMemberId: data.leadMemberId || undefined },
          user,
        ),
        { status: 201 },
      );
    }

    if (action === 'update') {
      const data = z
        .object({
          id: z.string().uuid(),
          status: z.nativeEnum(ResearchStatus).optional(),
          documentUrl: z.string().optional(),
          notes: z.string().optional(),
        })
        .parse(body);
      return NextResponse.json(await updateResearchProject(data.id, data, user));
    }

    throw new HttpError(400, 'Action research tidak dikenal.');
  } catch (error) {
    return handleRouteError(error);
  }
}
