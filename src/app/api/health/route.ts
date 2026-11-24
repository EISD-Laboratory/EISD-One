import { NextResponse } from 'next/server';
import { prisma } from '@/core/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      service: 'eisd-one',
      database: 'up',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        service: 'eisd-one',
        database: 'down',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
