import { MediaRequestStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/core/auth';
import { handleRouteError, HttpError } from '@/core/http';
import {
  createMediaRequest,
  listMediaRequests,
  updateMediaRequest,
} from '@/modules/media/media.service';

export async function GET() {
  try {
    await requirePermission(['media.request.read']);
    return NextResponse.json(await listMediaRequests());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(['media.request.manage']);
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || 'create');

    if (action === 'create') {
      const data = z
        .object({
          title: z.string().min(3),
          requesterDivision: z.string().optional(),
          channel: z.string().optional(),
          picMemberId: z.string().uuid().optional().or(z.literal('')),
          picName: z.string().optional(),
          dueDate: z.string().optional(),
          publishAt: z.string().optional(),
          brief: z.string().optional(),
          assetUrl: z.string().optional(),
          syncCalendar: z.boolean().optional(),
        })
        .parse(body);
      return NextResponse.json(
        await createMediaRequest({ ...data, picMemberId: data.picMemberId || undefined }, user),
        { status: 201 },
      );
    }

    if (action === 'update') {
      const data = z
        .object({
          id: z.string().uuid(),
          status: z.nativeEnum(MediaRequestStatus).optional(),
          assetUrl: z.string().optional(),
          picMemberId: z.string().uuid().optional().or(z.literal('')),
          picName: z.string().optional(),
        })
        .parse(body);
      return NextResponse.json(
        await updateMediaRequest(
          data.id,
          { ...data, picMemberId: data.picMemberId || undefined },
          user,
        ),
      );
    }

    throw new HttpError(400, 'Action media tidak dikenal.');
  } catch (error) {
    return handleRouteError(error);
  }
}
