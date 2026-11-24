import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/core/db';
import { assertRateLimit, handleRouteError, HttpError } from '@/core/http';
import { registerPublicAttendee } from '@/modules/event/event.service';

export async function GET(_req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const event = await prisma.eventItem.findFirst({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        speaker: true,
        startAt: true,
        endAt: true,
        location: true,
        isPublicOpen: true,
      },
    });
    if (!event) throw new HttpError(404, 'Event tidak ditemukan.');
    return NextResponse.json(event);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    assertRateLimit(`event-reg:${ip}`, 20, 60_000);

    const { slug } = await context.params;
    const data = z
      .object({
        name: z.string().min(2),
        nim: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        institution: z.string().optional(),
      })
      .parse(await req.json());

    const result = await registerPublicAttendee(slug, data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
