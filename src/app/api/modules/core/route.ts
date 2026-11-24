import { AssetCondition, CoreRecordType, TransactionType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/core/auth';
import { handleRouteError, HttpError } from '@/core/http';
import {
  createAsset,
  createCoreRecord,
  createManualTransaction,
  exportCoreTransactions,
  getCoreOverview,
} from '@/modules/core/core.service';

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(['core.finance.read']);
    const format = req.nextUrl.searchParams.get('export');
    if (format === 'xlsx' || format === 'csv') {
      const file = await exportCoreTransactions(format, user);
      return new NextResponse(new Uint8Array(file.buffer), {
        headers: {
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.fileName}"`,
        },
      });
    }
    return NextResponse.json(await getCoreOverview());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const kind = String(body.kind || '');

    if (kind === 'transaction') {
      const user = await requirePermission(['core.finance.manage']);
      const data = z
        .object({
          type: z.nativeEnum(TransactionType),
          category: z.string().min(2),
          description: z.string().min(2),
          amount: z.coerce.number().int().positive(),
          transactionDate: z.string(),
        })
        .parse(body);
      return NextResponse.json(await createManualTransaction(data, user), { status: 201 });
    }

    if (kind === 'asset') {
      const user = await requirePermission(['core.finance.manage']);
      const data = z
        .object({
          code: z.string().min(2),
          name: z.string().min(2),
          category: z.string().min(2),
          condition: z.nativeEnum(AssetCondition).default(AssetCondition.GOOD),
          location: z.string().optional(),
          quantity: z.coerce.number().int().min(1).default(1),
          notes: z.string().optional(),
        })
        .parse(body);
      return NextResponse.json(await createAsset(data, user), { status: 201 });
    }

    if (kind === 'record') {
      const user = await requirePermission(['core.record.manage']);
      const data = z
        .object({
          recordType: z.nativeEnum(CoreRecordType),
          referenceNo: z.string().optional(),
          title: z.string().min(2),
          recordDate: z.string(),
          summary: z.string().optional(),
          documentUrl: z.string().optional(),
        })
        .parse(body);
      return NextResponse.json(await createCoreRecord(data, user), { status: 201 });
    }

    throw new HttpError(400, 'Field kind tidak dikenal (gunakan transaction/asset/record).');
  } catch (error) {
    return handleRouteError(error);
  }
}
