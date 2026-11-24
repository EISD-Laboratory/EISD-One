import { ImportDuplicateStrategy } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/core/auth';
import { prisma } from '@/core/db';
import { handleRouteError, HttpError } from '@/core/http';
import { commitMemberImport, previewMemberImport, rollbackImportBatch } from '@/core/member-import';

export async function GET() {
  try {
    await requirePermission(['member.member.import']);
    const items = await prisma.importBatch.findMany({
      where: { entityType: 'members' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return NextResponse.json({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(['member.member.import']);
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        throw new HttpError(400, 'File Excel (.xlsx) atau CSV (.csv) wajib diunggah.');
      }
      const strategyRaw = String(formData.get('duplicateStrategy') || 'SKIP');
      const strategy = (
        ['SKIP', 'OVERWRITE', 'MERGE'].includes(strategyRaw) ? strategyRaw : 'SKIP'
      ) as ImportDuplicateStrategy;

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await previewMemberImport({ name: file.name, buffer }, strategy, user);
      return NextResponse.json(result);
    }

    const body = (await req.json()) as {
      action?: 'commit' | 'rollback';
      batchId?: string;
      duplicateStrategy?: ImportDuplicateStrategy;
      columnMapping?: Record<string, string>;
    };

    if (!body.batchId) throw new HttpError(400, 'batchId wajib diisi.');
    if (body.action === 'rollback') {
      return NextResponse.json(await rollbackImportBatch(body.batchId, user));
    }

    return NextResponse.json(
      await commitMemberImport(
        body.batchId,
        { duplicateStrategy: body.duplicateStrategy, columnMapping: body.columnMapping },
        user,
      ),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
