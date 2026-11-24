import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/core/auth';
import { createCustomModule, listCustomModules } from '@/core/custom-modules';
import { handleRouteError } from '@/core/http';

const fieldSchema = z.object({
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(80),
  type: z.enum(['text', 'number', 'date', 'select', 'textarea']),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    await requirePermission([], true);
    return NextResponse.json(await listCustomModules());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(['custom_module.manage']);
    const data = z
      .object({
        code: z.string().min(2).max(50),
        name: z.string().min(2).max(120),
        description: z.string().optional(),
        fields: z.array(fieldSchema).min(1),
      })
      .parse(await req.json());

    const created = await createCustomModule(data, user);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
