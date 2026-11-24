import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/core/auth';
import { handleRouteError, HttpError } from '@/core/http';
import {
  addStudyGroupSession,
  createStudyGroup,
  exportStudyGroupSessions,
  listStudyGroups,
} from '@/modules/study-group/study-group.service';

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(['study_group.class.read']);
    const exportGroupId = req.nextUrl.searchParams.get('exportGroupId');
    if (exportGroupId) {
      const format = req.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
      const file = await exportStudyGroupSessions(exportGroupId, format, user);
      return new NextResponse(new Uint8Array(file.buffer), {
        headers: {
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.fileName}"`,
        },
      });
    }
    return NextResponse.json(await listStudyGroups());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(['study_group.class.manage']);
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || 'create_group');

    if (action === 'create_group') {
      const data = z
        .object({
          code: z.string().min(2),
          name: z.string().min(3),
          topic: z.string().min(2),
          mentorMemberId: z.string().uuid().optional().or(z.literal('')),
          mentorName: z.string().optional(),
          schedule: z.string().optional(),
          maxParticipants: z.coerce.number().int().min(1).optional(),
          notes: z.string().optional(),
        })
        .parse(body);
      return NextResponse.json(
        await createStudyGroup({ ...data, mentorMemberId: data.mentorMemberId || undefined }, user),
        { status: 201 },
      );
    }

    if (action === 'add_session') {
      const data = z
        .object({
          groupId: z.string().uuid(),
          sessionNo: z.coerce.number().int().min(1),
          title: z.string().min(2),
          sessionDate: z.string(),
          materialUrl: z.string().optional(),
          attendeeCount: z.coerce.number().int().min(0).optional(),
          attendeesText: z.string().optional(),
          notes: z.string().optional(),
          syncCalendar: z.boolean().optional(),
        })
        .parse(body);
      return NextResponse.json(await addStudyGroupSession(data, user), { status: 201 });
    }

    throw new HttpError(400, 'Action study group tidak dikenal.');
  } catch (error) {
    return handleRouteError(error);
  }
}
