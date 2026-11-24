import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/core/auth';
import { handleRouteError } from '@/core/http';
import { exportMembersFile, generateMemberTemplate } from '@/core/member-import';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const format = sp.get('format') === 'csv' ? 'csv' : 'xlsx';
    const isTemplate = sp.get('template') === 'true';

    if (isTemplate) {
      await requirePermission(['member.member.import']);
      const tpl = await generateMemberTemplate(format);
      return new NextResponse(new Uint8Array(tpl.buffer), {
        headers: {
          'Content-Type': tpl.contentType,
          'Content-Disposition': `attachment; filename="${tpl.fileName}"`,
        },
      });
    }

    const user = await requirePermission(['member.member.export']);
    const exp = await exportMembersFile(
      format,
      {
        search: sp.get('search') || undefined,
        status: sp.get('status') || undefined,
        divisionId: sp.get('divisionId') || undefined,
        generation: sp.get('generation') || undefined,
      },
      user,
    );

    return new NextResponse(new Uint8Array(exp.buffer), {
      headers: {
        'Content-Type': exp.contentType,
        'Content-Disposition': `attachment; filename="${exp.fileName}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
