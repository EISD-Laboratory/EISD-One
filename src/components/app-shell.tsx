'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Award,
  Blocks,
  BookOpen,
  CalendarDays,
  FileSpreadsheet,
  FlaskConical,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  Layers,
  LogOut,
  Megaphone,
  Palette,
  Puzzle,
  ScrollText,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from './auth-context';
import { apiFetch } from './client-api';
import { Badge } from './ui';

const CORE_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/members', label: 'Anggota', permission: 'member.member.read', icon: Users },
  {
    href: '/members/import',
    label: 'Import Excel/CSV',
    permission: 'member.member.import',
    icon: FileSpreadsheet,
  },
  { href: '/kpi', label: 'KPI Anggota', permission: 'kpi.result.read', icon: Award },
  { href: '/calendar', label: 'Kalender', permission: 'calendar.item.read', icon: CalendarDays },
];

const MODULE_NAV = [
  {
    code: 'core',
    href: '/core',
    label: 'Core (Kas & Aset)',
    permission: 'core.finance.read',
    icon: Wallet,
  },
  {
    code: 'event',
    href: '/event',
    label: 'Event',
    permission: 'event.event.read',
    icon: Megaphone,
  },
  {
    code: 'praktikum',
    href: '/praktikum',
    label: 'Praktikum',
    permission: 'praktikum.course.read',
    icon: BookOpen,
  },
  {
    code: 'enabler',
    href: '/enabler',
    label: 'Enabler',
    permission: 'enabler.partner.read',
    icon: Handshake,
  },
  {
    code: 'media',
    href: '/media',
    label: 'Media',
    permission: 'media.request.read',
    icon: Palette,
  },
  {
    code: 'competition',
    href: '/competition',
    label: 'Competition',
    permission: 'competition.entry.read',
    icon: Trophy,
  },
  {
    code: 'research',
    href: '/research',
    label: 'Research & Community',
    permission: 'research.project.read',
    icon: FlaskConical,
  },
  {
    code: 'study-group',
    href: '/study-group',
    label: 'Study Group',
    permission: 'study_group.class.read',
    icon: GraduationCap,
  },
];

const ADMIN_NAV = [
  { href: '/periods', label: 'Periode & Modul', permission: 'member.period.read', icon: Layers },
  {
    href: '/custom-modules',
    label: 'Custom Module',
    permission: 'custom_module.manage',
    icon: Blocks,
  },
  { href: '/rbac', label: 'RBAC & Akun', permission: 'rbac.role.read', icon: ShieldCheck },
  { href: '/audit-logs', label: 'Audit Log', permission: 'audit.log.read', icon: ScrollText },
  { href: '/settings', label: 'Pengaturan', permission: 'settings.system.read', icon: Settings },
];

interface CustomModuleSummary {
  id: string;
  code: string;
  name: string;
  division: { isEnabled: boolean };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout, logoutAll, hasPermission } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [enabledModules, setEnabledModules] = useState<Set<string> | null>(null);
  const [customModules, setCustomModules] = useState<CustomModuleSummary[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    void apiFetch<Array<{ code: string; isEnabled: boolean }>>('/api/divisions')
      .then((divs) =>
        setEnabledModules(new Set(divs.filter((d) => d.isEnabled).map((d) => d.code))),
      )
      .catch(() => setEnabledModules(null));

    void apiFetch<CustomModuleSummary[]>('/api/custom-modules')
      .then((mods) => setCustomModules(mods.filter((m) => m.division?.isEnabled)))
      .catch(() => setCustomModules([]));
  }, [user, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Memuat EISD One...
      </div>
    );
  }
  if (!user) return null;

  const renderLinks = (
    items: Array<{ href: string; label: string; permission?: string; icon: typeof Users }>,
  ) =>
    items
      .filter((item) => !item.permission || hasPermission(item.permission))
      .map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== '/members' &&
            item.href !== '/dashboard' &&
            pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      });

  const visibleModules = MODULE_NAV.filter(
    (m) => (!enabledModules || enabledModules.has(m.code)) && hasPermission(m.permission),
  );

  const visibleCustomLinks = hasPermission('custom_module.record.read')
    ? customModules.map((m) => ({
        href: `/custom/${m.code}`,
        label: m.name,
        icon: Puzzle,
      }))
    : [];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-900">EISD One</span>
            <Badge variant="secondary">Modular</Badge>
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">Sistem Internal Lab EISD</p>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Utama
            </p>
            {renderLinks(CORE_NAV)}
          </div>

          {visibleModules.length > 0 && (
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Modul Divisi
              </p>
              {renderLinks(visibleModules)}
            </div>
          )}

          {visibleCustomLinks.length > 0 && (
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Custom Module
              </p>
              {renderLinks(visibleCustomLinks)}
            </div>
          )}

          <div className="space-y-1">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Administrasi
            </p>
            {renderLinks(ADMIN_NAV)}
          </div>
        </nav>

        <div className="border-t border-slate-200 p-4">
          <p className="truncate text-sm font-semibold text-slate-900">{user.fullName}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
          <div className="mt-1.5 mb-3 flex flex-wrap gap-1">
            {user.roles.map((r) => (
              <Badge key={r.id} variant={r.code === 'super_admin' ? 'default' : 'secondary'}>
                {r.name}
              </Badge>
            ))}
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <LogOut className="h-3.5 w-3.5" /> Keluar
            </button>
            <button
              type="button"
              onClick={() => void logoutAll()}
              className="w-full py-1 text-xs text-slate-400 hover:text-slate-700"
            >
              Keluar Semua Perangkat
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
    </div>
  );
}
