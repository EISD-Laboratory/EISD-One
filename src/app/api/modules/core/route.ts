import { AssetCondition, CoreRecordType, TransactionType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/core/auth';
import { handleRouteError, HttpError } from '@/core/http';
import {
  bulkMarkKasPaid,
  createAsset,
  createCoreRecord,
  createGeneratedLetter,
  createManualTransaction,
  deleteCoreRecord,
  deleteTransaction,
  exportCoreTransactions,
  getCoreOverview,
  toggleKasPayment,
  type CoreFinanceFilter,
} from '@/modules/core/core.service';

function parseFinanceFilter(req: NextRequest): CoreFinanceFilter {
  const sp = req.nextUrl.searchParams;
  const rawType = sp.get('type');
  const type: CoreFinanceFilter['type'] =
    rawType === 'INCOME' || rawType === 'EXPENSE' ? rawType : 'ALL';

  const rawYear = sp.get('year');
  const year = rawYear && rawYear !== 'ALL' ? Number(rawYear) : null;

  const rawMonth = sp.get('month');
  const month = rawMonth && rawMonth !== 'ALL' ? Number(rawMonth) : null;

  const rawAnalyticsYear = sp.get('analyticsYear');
  const analyticsYear =
    rawAnalyticsYear && Number.isFinite(Number(rawAnalyticsYear))
      ? Number(rawAnalyticsYear)
      : year && Number.isFinite(year)
        ? year
        : new Date().getUTCFullYear();

  return {
    type,
    year: year && Number.isFinite(year) ? year : null,
    month: month && Number.isFinite(month) ? month : null,
    category: sp.get('category') || null,
    sourceModule: sp.get('sourceModule') || null,
    search: sp.get('search') || null,
    analyticsYear,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(['core.finance.read']);
    const filter = parseFinanceFilter(req);
    const format = req.nextUrl.searchParams.get('export');
    const rawScope = req.nextUrl.searchParams.get('scope');
    const scope = rawScope === 'transactions' || rawScope === 'kas' ? rawScope : 'full';

    if (format === 'xlsx' || format === 'csv') {
      const file = await exportCoreTransactions(format, user, filter, scope);
      return new NextResponse(new Uint8Array(file.buffer), {
        headers: {
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.fileName}"`,
        },
      });
    }
    return NextResponse.json(await getCoreOverview(filter));
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

    if (kind === 'kas_toggle') {
      const user = await requirePermission(['core.finance.manage']);
      const data = z
        .object({
          memberId: z.string().uuid(),
          year: z.coerce.number().int().min(2020).max(2100),
          month: z.coerce.number().int().min(1).max(12),
          paid: z.boolean(),
          amount: z.coerce.number().int().positive().optional(),
          paidAt: z.string().optional(),
          notes: z.string().optional(),
        })
        .parse(body);
      return NextResponse.json(await toggleKasPayment(data, user));
    }

    if (kind === 'kas_bulk_pay') {
      const user = await requirePermission(['core.finance.manage']);
      const data = z
        .object({
          year: z.coerce.number().int().min(2020).max(2100),
          month: z.coerce.number().int().min(1).max(12),
          memberIds: z.array(z.string().uuid()).optional(),
        })
        .parse(body);
      return NextResponse.json(await bulkMarkKasPaid(data, user));
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

    if (kind === 'generated_letter') {
      const user = await requirePermission(['core.record.manage']);
      const data = z
        .object({
          templateCode: z.enum(['UND', 'PMH', 'PJM', 'SKT', 'STG', 'UMM']),
          letterDate: z.string().min(8),
          city: z.string().default('Bandung'),
          attachment: z.string().default('-'),
          subject: z.string().min(2),
          recipientName: z.string().default(''),
          recipientOrg: z.string().default(''),
          recipientPlace: z.string().default('Tempat'),
          purpose: z.string().default(''),
          eventDate: z.string().default(''),
          eventTime: z.string().default(''),
          eventLocation: z.string().default(''),
          itemDetails: z.string().default(''),
          memberName: z.string().default(''),
          memberNim: z.string().default(''),
          memberDivision: z.string().default(''),
          periodName: z.string().default('2026/2027'),
          customBody: z.string().default(''),
          chairName: z.string().default('Alya Pratama'),
          chairId: z.string().default(''),
          secretaryName: z.string().default('Bima Mahendra'),
          secretaryId: z.string().default(''),
        })
        .parse(body);
      return NextResponse.json(await createGeneratedLetter(data, user), { status: 201 });
    }

    throw new HttpError(
      400,
      'Field kind tidak dikenal (gunakan transaction/kas_toggle/kas_bulk_pay/asset/record/generated_letter).',
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    const kind = req.nextUrl.searchParams.get('kind');
    if (!id) throw new HttpError(400, 'Parameter id wajib diisi.');
    if (kind === 'record') {
      const user = await requirePermission(['core.record.manage']);
      return NextResponse.json(await deleteCoreRecord(id, user));
    }
    const user = await requirePermission(['core.finance.manage']);
    return NextResponse.json(await deleteTransaction(id, user));
  } catch (error) {
    return handleRouteError(error);
  }
}
