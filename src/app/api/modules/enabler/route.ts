import { PartnerStage } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/core/auth';
import { handleRouteError, HttpError } from '@/core/http';
import {
  approveRecognition,
  createPartner,
  getEnablerOverview,
  proposeRecognition,
  updatePartner,
} from '@/modules/enabler/enabler.service';

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(['enabler.partner.read']);
    const now = new Date();
    const year = Number(req.nextUrl.searchParams.get('year') || now.getUTCFullYear());
    const month = Number(req.nextUrl.searchParams.get('month') || now.getUTCMonth() + 1);
    return NextResponse.json(await getEnablerOverview(year, month, user));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(['enabler.partner.manage']);
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'create_partner') {
      const data = z
        .object({
          name: z.string().min(2),
          picName: z.string().optional(),
          picContact: z.string().optional(),
          stage: z.nativeEnum(PartnerStage).default(PartnerStage.PROSPECT),
          mouExpiresAt: z.string().optional(),
          obligations: z.array(z.object({ title: z.string(), done: z.boolean() })).optional(),
          notes: z.string().optional(),
        })
        .parse(body);
      return NextResponse.json(await createPartner(data, user), { status: 201 });
    }

    if (action === 'update_partner') {
      const data = z
        .object({
          id: z.string().uuid(),
          stage: z.nativeEnum(PartnerStage).optional(),
          obligations: z.array(z.object({ title: z.string(), done: z.boolean() })).optional(),
          notes: z.string().optional(),
        })
        .parse(body);
      return NextResponse.json(await updatePartner(data.id, data, user));
    }

    if (action === 'propose_recognition') {
      const data = z
        .object({
          year: z.coerce.number().int(),
          month: z.coerce.number().int().min(1).max(12),
          memberId: z.string().uuid(),
          title: z.string().optional(),
          overrideReason: z.string().optional(),
          rewardAmount: z.coerce.number().int().min(0).optional(),
        })
        .parse(body);
      return NextResponse.json(await proposeRecognition(data, user), { status: 201 });
    }

    if (action === 'approve_recognition') {
      const { id } = z.object({ id: z.string().uuid() }).parse(body);
      return NextResponse.json(await approveRecognition(id, user));
    }

    throw new HttpError(400, 'Action enabler tidak dikenal.');
  } catch (error) {
    return handleRouteError(error);
  }
}
