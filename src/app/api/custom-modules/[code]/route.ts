import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/core/auth';
import {
  createCustomRecord,
  deleteCustomRecord,
  exportCustomModuleRecords,
  getCustomModuleWithRecords,
} from '@/core/custom-modules';
import { handleRouteError } from '@/core/http';

export async function GET(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await requirePermission(['custom_module.record.read']);
    const { code } = await context.params;
    const exportFmt = req.nextUrl.searchParams.get('export');
    if (exportFmt === 'xlsx' || exportFmt === 'csv') {
      const file = await exportCustomModuleRecords(code, exportFmt, user);
      return new NextResponse(new Uint8Array(file.buffer), {
        headers: {
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.fileName}"`,
        },
      });
    }
    return NextResponse.json(await getCustomModuleWithRecords(code));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await requirePermission(['custom_module.record.manage']);
    const { code } = await context.params;
    const body = z
      .object({
        title: z.string().min(2).max(200),
        data: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(await req.json());

    const created = await createCustomRecord(code, body, user);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await requirePermission(['custom_module.record.manage']);
    const { code } = await context.params;
    const recordId = req.nextUrl.searchParams.get('id') || '';
    const { id } = z.object({ id: z.string().uuid() }).parse({ id: recordId });
    return NextResponse.json(await deleteCustomRecord(code, id, user));
  } catch (error) {
    return handleRouteError(error);
  }
}
