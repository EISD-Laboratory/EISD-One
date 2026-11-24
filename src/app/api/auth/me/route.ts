import { NextResponse } from 'next/server';
import { requirePermission } from '@/core/auth';
import { handleRouteError } from '@/core/http';

export async function GET() {
  try {
    const user = await requirePermission([], true);
    return NextResponse.json({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
