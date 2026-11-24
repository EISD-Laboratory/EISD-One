import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/core/auth';
import { handleRouteError } from '@/core/http';
import { exportKpiResultsFile } from '@/core/kpi';

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(['kpi.result.export']);
    const sp = req.nextUrl.searchParams;
    const format = sp.get('format') === 'csv' ? 'csv' : 'xlsx';
    const file = await exportKpiResultsFile(
      format,
      {
        frameworkId: sp.get('frameworkId') || undefined,
        year: sp.get('year') ? Number(sp.get('year')) : undefined,
        month: sp.get('month') ? Number(sp.get('month')) : undefined,
      },
      user,
    );

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename="${file.fileName}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
