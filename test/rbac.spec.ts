import { describe, expect, it } from 'vitest';
import {
  assertAllowedEmailDomain,
  assertDivisionAccess,
  authorizeUser,
  type SessionUser,
} from '@/core/auth';
import { HttpError } from '@/core/http';

const admin: SessionUser = {
  id: 'u-admin',
  email: 'admin@eisd.local',
  fullName: 'Administrator',
  isSuperAdmin: true,
  roles: [
    { id: 'r0', code: 'super_admin', name: 'Super Admin', scope: 'GLOBAL', divisionId: null },
  ],
  permissions: [],
  divisionIds: [],
};

const kadivEvent: SessionUser = {
  id: 'u-kadiv',
  email: 'kadiv.event@eisd.local',
  fullName: 'Kadiv Event',
  isSuperAdmin: false,
  roles: [
    {
      id: 'r1',
      code: 'kadiv_event',
      name: 'Kadiv Event',
      scope: 'DIVISION',
      divisionId: 'div-event',
    },
  ],
  permissions: ['member.member.read', 'member.member.create'],
  divisionIds: ['div-event'],
};

describe('Auth & RBAC (Default-Deny)', () => {
  it('menolak user belum login (401) dan menolak endpoint tanpa permission (403 default-deny)', () => {
    expect(() => authorizeUser(null, ['member.member.read'])).toThrow(HttpError);
    expect(() => authorizeUser(kadivEvent, [])).toThrow(HttpError);
  });

  it('mengizinkan Super Admin ke semua permission termasuk custom modul', () => {
    expect(authorizeUser(admin, ['custom.anything.manage']).id).toBe('u-admin');
  });

  it('memeriksa permission granular dan membatasi Kadiv hanya pada divisinya sendiri', () => {
    expect(authorizeUser(kadivEvent, ['member.member.read']).id).toBe('u-kadiv');
    expect(() => authorizeUser(kadivEvent, ['rbac.role.manage'])).toThrow(HttpError);
    expect(() => assertDivisionAccess(kadivEvent, 'div-event')).not.toThrow();
    expect(() => assertDivisionAccess(kadivEvent, 'div-media')).toThrow(HttpError);
    expect(() => assertDivisionAccess(admin, 'div-media')).not.toThrow();
  });

  it('memfilter domain email kampus sesuai AUTH_ALLOWED_EMAIL_DOMAINS', () => {
    expect(() => assertAllowedEmailDomain('siapa@gmail.com', '')).not.toThrow();
    expect(() =>
      assertAllowedEmailDomain('ketua@student.kampus.ac.id', 'student.kampus.ac.id'),
    ).not.toThrow();
    expect(() => assertAllowedEmailDomain('luar@gmail.com', 'student.kampus.ac.id')).toThrow(
      HttpError,
    );
  });
});
