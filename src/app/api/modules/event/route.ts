import { EventStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/core/auth';
import { handleRouteError, HttpError } from '@/core/http';
import {
  addCommitteeMember,
  createEvent,
  exportEventParticipants,
  listEvents,
  toggleParticipantAttendance,
  updateEventStatus,
} from '@/modules/event/event.service';

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(['event.event.read']);
    const exportEventId = req.nextUrl.searchParams.get('exportEventId');
    if (exportEventId) {
      const format = req.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
      const file = await exportEventParticipants(exportEventId, format, user);
      return new NextResponse(new Uint8Array(file.buffer), {
        headers: {
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.fileName}"`,
        },
      });
    }
    return NextResponse.json(await listEvents());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(['event.event.manage']);
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || 'create');

    if (action === 'create') {
      const data = z
        .object({
          title: z.string().min(3),
          description: z.string().optional(),
          speaker: z.string().optional(),
          startAt: z.string(),
          endAt: z.string(),
          location: z.string().optional(),
          budgetAmount: z.coerce.number().int().min(0).optional(),
          isPublicOpen: z.boolean().optional(),
          sponsorNeeded: z.boolean().optional(),
        })
        .parse(body);
      return NextResponse.json(await createEvent(data, user), { status: 201 });
    }

    if (action === 'status') {
      const data = z
        .object({
          eventId: z.string().uuid(),
          status: z.nativeEnum(EventStatus),
          actualExpense: z.coerce.number().int().min(0).optional(),
          lpjNotes: z.string().optional(),
          isPublicOpen: z.boolean().optional(),
        })
        .parse(body);
      return NextResponse.json(await updateEventStatus(data.eventId, data, user));
    }

    if (action === 'add_committee') {
      const data = z
        .object({
          eventId: z.string().uuid(),
          memberId: z.string().uuid(),
          position: z.string().optional(),
        })
        .parse(body);
      return NextResponse.json(await addCommitteeMember(data, user), { status: 201 });
    }

    if (action === 'attendance') {
      const data = z
        .object({ participantId: z.string().uuid(), attended: z.boolean() })
        .parse(body);
      return NextResponse.json(
        await toggleParticipantAttendance(data.participantId, data.attended, user),
      );
    }

    throw new HttpError(400, 'Action event tidak dikenal.');
  } catch (error) {
    return handleRouteError(error);
  }
}
