import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/core/auth';
import { handleRouteError } from '@/core/http';
import { listSettings, setSetting } from '@/core/settings';

export async function GET() {
  try {
    await requirePermission(['settings.system.read']);
    return NextResponse.json(await listSettings());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await requirePermission(['settings.system.manage']);
    const { key, value, description } = z
      .object({ key: z.string().min(1), value: z.unknown(), description: z.string().optional() })
      .parse(await req.json());

    const saved = await setSetting(key, value, actor, description);
    return NextResponse.json(saved);
  } catch (error) {
    return handleRouteError(error);
  }
}
