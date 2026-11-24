import { PraktikumRecordType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/core/auth';
import { generateCsvBuffer, generateXlsxBuffer } from '@/core/excel';
import { handleRouteError, HttpError } from '@/core/http';
import {
  createPraktikumCourse,
  exportPraktikumRecords,
  importPraktikumExcel,
  listPraktikumCourses,
  PRAKTIKUM_IMPORT_COLUMNS,
} from '@/modules/praktikum/praktikum.service';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    if (sp.get('template') === 'true') {
      await requirePermission(['praktikum.grade.import']);
      const format = sp.get('format') === 'csv' ? 'csv' : 'xlsx';
      const sample = Object.fromEntries(
        PRAKTIKUM_IMPORT_COLUMNS.map((c) => [c.key, c.example ?? '']),
      );
      const buffer =
        format === 'csv'
          ? generateCsvBuffer(PRAKTIKUM_IMPORT_COLUMNS, [sample])
          : await generateXlsxBuffer('Template Praktikum', PRAKTIKUM_IMPORT_COLUMNS, [sample]);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type':
            format === 'csv'
              ? 'text/csv; charset=utf-8'
              : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="template-praktikum.${format}"`,
        },
      });
    }

    const user = await requirePermission(['praktikum.course.read']);
    const exportCourseId = sp.get('exportCourseId');
    if (exportCourseId) {
      const format = sp.get('format') === 'csv' ? 'csv' : 'xlsx';
      const file = await exportPraktikumRecords(exportCourseId, format, user);
      return new NextResponse(new Uint8Array(file.buffer), {
        headers: {
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.fileName}"`,
        },
      });
    }

    return NextResponse.json(await listPraktikumCourses());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const user = await requirePermission(['praktikum.grade.import']);
      const fd = await req.formData();
      const file = fd.get('file');
      const courseId = String(fd.get('courseId') || '');
      const recordTypeRaw = String(fd.get('recordType') || 'GRADE');
      if (!(file instanceof File) || !courseId) {
        throw new HttpError(400, 'courseId dan file Excel/CSV wajib diisi.');
      }
      const recordType =
        recordTypeRaw === 'ATTENDANCE' ? PraktikumRecordType.ATTENDANCE : PraktikumRecordType.GRADE;
      const res = await importPraktikumExcel(
        courseId,
        recordType,
        { name: file.name, buffer: Buffer.from(await file.arrayBuffer()) },
        user,
      );
      return NextResponse.json(res);
    }

    const user = await requirePermission(['praktikum.course.manage']);
    const data = z
      .object({
        code: z.string().min(2),
        name: z.string().min(2),
        semester: z.string().min(2),
        schedule: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(await req.json());

    return NextResponse.json(await createPraktikumCourse(data, user), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
