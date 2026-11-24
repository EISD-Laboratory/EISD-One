import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/core/auth';
import { handleRouteError } from '@/core/http';
import { getCoreLetterForPdf } from '@/modules/core/core.service';
import { generateOfficialLetterPdfBuffer } from '@/modules/core/letter-pdf';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(['core.finance.read']);
    const { id } = await context.params;
    const letter = await getCoreLetterForPdf(id);
    const pdf = await generateOfficialLetterPdfBuffer(letter.payload, letter.referenceNo);
    const download = req.nextUrl.searchParams.get('download') === '1';
    const safeFile = letter.referenceNo.replace(/[^a-zA-Z0-9_-]+/g, '-');

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="surat-${safeFile}.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
