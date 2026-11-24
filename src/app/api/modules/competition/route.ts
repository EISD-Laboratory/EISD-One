import { CompetitionStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/core/auth';
import { handleRouteError, HttpError } from '@/core/http';
import {
  createCompetitionEntry,
  listCompetitionEntries,
  updateCompetitionEntry,
} from '@/modules/competition/competition.service';

export async function GET() {
  try {
    await requirePermission(['competition.entry.read']);
    return NextResponse.json(await listCompetitionEntries());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(['competition.entry.manage']);
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || 'create');

    if (action === 'create') {
      const data = z
        .object({
          competitionName: z.string().min(3),
          organizer: z.string().optional(),
          level: z.string().optional(),
          teamName: z.string().min(2),
          memberIds: z.array(z.string().uuid()).optional(),
          memberNames: z.string().optional(),
          eventDate: z.string(),
          registrationFee: z.coerce.number().int().min(0).optional(),
          recordToCash: z.boolean().optional(),
          syncCalendar: z.boolean().optional(),
          notes: z.string().optional(),
        })
        .parse(body);
      return NextResponse.json(await createCompetitionEntry(data, user), { status: 201 });
    }

    if (action === 'update') {
      const data = z
        .object({
          id: z.string().uuid(),
          status: z.nativeEnum(CompetitionStatus).optional(),
          achievement: z.string().optional(),
          recordToCash: z.boolean().optional(),
        })
        .parse(body);
      return NextResponse.json(await updateCompetitionEntry(data.id, data, user));
    }

    throw new HttpError(400, 'Action competition tidak dikenal.');
  } catch (error) {
    return handleRouteError(error);
  }
}
