import { NextRequest, NextResponse } from 'next/server';
import { listAuditLogs } from '@/core/audit';
import { requirePermission } from '@/core/auth';
import { handleRouteError } from '@/core/http';

export async function GET(req: NextRequest) {
  try {
    await requirePermission(['audit.log.read']);
    const sp = req.nextUrl.searchParams;
    const data = await listAuditLogs({
      page: Number(sp.get('page') || 1),
      limit: Number(sp.get('limit') || 30),
      module: sp.get('module') || undefined,
      search: sp.get('search') || undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
