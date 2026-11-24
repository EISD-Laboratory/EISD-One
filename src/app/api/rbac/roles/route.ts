import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/core/audit';
import { requirePermission } from '@/core/auth';
import { prisma } from '@/core/db';
import { handleRouteError, HttpError } from '@/core/http';
import { isFeatureEnabled } from '@/core/settings';

export async function GET() {
  try {
    await requirePermission(['rbac.role.read']);
    const extraEnabled = await isFeatureEnabled('rbac.extra_roles', false);

    const [roles, permissions] = await Promise.all([
      prisma.role.findMany({
        where: { deletedAt: null, ...(extraEnabled ? {} : { isExtraRole: false }) },
        include: {
          rolePermissions: { include: { permission: { select: { code: true } } } },
          _count: { select: { userRoles: true } },
        },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      }),
      prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] }),
    ]);

    return NextResponse.json({
      roles: roles.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        scope: r.scope,
        isSystem: r.isSystem,
        userCount: r._count.userRoles,
        permissions: r.rolePermissions.map((rp) => rp.permission.code),
      })),
      permissions,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission(['rbac.role.manage']);
    const { roleId, permissionCodes } = z
      .object({ roleId: z.string().uuid(), permissionCodes: z.array(z.string()) })
      .parse(await req.json());

    const role = await prisma.role.findFirst({
      where: { id: roleId, deletedAt: null },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) throw new HttpError(404, 'Role tidak ditemukan.');

    const beforeCodes = role.rolePermissions.map((rp) => rp.permission.code).sort();
    const perms = await prisma.permission.findMany({ where: { code: { in: permissionCodes } } });

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (perms.length > 0) {
        await tx.rolePermission.createMany({
          data: perms.map((p) => ({ roleId, permissionId: p.id })),
        });
      }
    });

    const afterCodes = perms.map((p) => p.code).sort();
    await recordAudit({
      actor: user,
      action: 'rbac.role.permissions_updated',
      module: 'rbac',
      entityType: 'Role',
      entityId: roleId,
      beforeData: { roleCode: role.code, permissions: beforeCodes },
      afterData: { roleCode: role.code, permissions: afterCodes },
    });

    return NextResponse.json({ roleId, permissions: afterCodes });
  } catch (error) {
    return handleRouteError(error);
  }
}
