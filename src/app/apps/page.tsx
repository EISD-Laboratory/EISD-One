'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CalendarDays, LogOut, Sparkles } from 'lucide-react';
import { AppModuleIcon, type AppIconKey } from '@/components/app-icons';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { Badge } from '@/components/ui';

interface LauncherApp {
  id: string;
  label: string;
  href: string;
  iconKey: AppIconKey;
  permission?: string;
  moduleCode?: string;
  isCustom?: boolean;
  customIndex?: number;
}

const BUILTIN_APPS: LauncherApp[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', iconKey: 'dashboard' },
  {
    id: 'calendar',
    label: 'Kalender',
    href: '/calendar',
    iconKey: 'calendar',
    permission: 'calendar.item.read',
  },
  {
    id: 'members',
    label: 'Anggota',
    href: '/members',
    iconKey: 'members',
    permission: 'member.member.read',
  },
  {
    id: 'kpi',
    label: 'KPI Anggota',
    href: '/kpi',
    iconKey: 'kpi',
    permission: 'kpi.result.read',
  },
  {
    id: 'core',
    label: 'Core Kas & Aset',
    href: '/core',
    iconKey: 'core',
    permission: 'core.finance.read',
    moduleCode: 'core',
  },
  {
    id: 'event',
    label: 'Event',
    href: '/event',
    iconKey: 'event',
    permission: 'event.event.read',
    moduleCode: 'event',
  },
  {
    id: 'praktikum',
    label: 'Praktikum',
    href: '/praktikum',
    iconKey: 'praktikum',
    permission: 'praktikum.course.read',
    moduleCode: 'praktikum',
  },
  {
    id: 'enabler',
    label: 'Enabler',
    href: '/enabler',
    iconKey: 'enabler',
    permission: 'enabler.partner.read',
    moduleCode: 'enabler',
  },
  {
    id: 'media',
    label: 'Media',
    href: '/media',
    iconKey: 'media',
    permission: 'media.request.read',
    moduleCode: 'media',
  },
  {
    id: 'competition',
    label: 'Competition',
    href: '/competition',
    iconKey: 'competition',
    permission: 'competition.entry.read',
    moduleCode: 'competition',
  },
  {
    id: 'research',
    label: 'Research',
    href: '/research',
    iconKey: 'research',
    permission: 'research.project.read',
    moduleCode: 'research',
  },
  {
    id: 'study-group',
    label: 'Study Group',
    href: '/study-group',
    iconKey: 'study-group',
    permission: 'study_group.class.read',
    moduleCode: 'study-group',
  },
  {
    id: 'periods',
    label: 'Periode & Modul',
    href: '/periods',
    iconKey: 'periods',
    permission: 'member.period.read',
  },
  {
    id: 'custom-modules',
    label: 'Custom Module',
    href: '/custom-modules',
    iconKey: 'custom-modules',
    permission: 'custom_module.manage',
  },
  {
    id: 'rbac',
    label: 'RBAC & Akun',
    href: '/rbac',
    iconKey: 'rbac',
    permission: 'rbac.role.read',
  },
  {
    id: 'audit-logs',
    label: 'Audit Log',
    href: '/audit-logs',
    iconKey: 'audit-logs',
    permission: 'audit.log.read',
  },
  {
    id: 'settings',
    label: 'Pengaturan',
    href: '/settings',
    iconKey: 'settings',
    permission: 'settings.system.read',
  },
];

interface CustomModSummary {
  id: string;
  code: string;
  name: string;
  division: { isEnabled: boolean };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export default function AppsLauncherPage() {
  const { user, loading, logout, hasPermission } = useAuth();
  const router = useRouter();
  const [enabledModules, setEnabledModules] = useState<Set<string> | null>(null);
  const [customModules, setCustomModules] = useState<CustomModSummary[]>([]);
  const [activePeriod, setActivePeriod] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);

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

    void apiFetch<CustomModSummary[]>('/api/custom-modules')
      .then((mods) => setCustomModules(mods.filter((m) => m.division?.isEnabled)))
      .catch(() => setCustomModules([]));

    void apiFetch<{
      activePeriod: { name: string } | null;
      stats: { pendingApprovals: number };
    }>('/api/dashboard')
      .then((d) => {
        setActivePeriod(d.activePeriod?.name ?? null);
        setPendingApprovals(d.stats?.pendingApprovals ?? 0);
      })
      .catch(() => undefined);
  }, [user]);

  const allApps = useMemo(() => {
    const builtIn = BUILTIN_APPS.filter((app) => {
      if (app.permission && !hasPermission(app.permission)) return false;
      if (app.moduleCode && enabledModules && !enabledModules.has(app.moduleCode)) return false;
      return true;
    });

    const dynamicCustom: LauncherApp[] = hasPermission('custom_module.record.read')
      ? customModules.map((m, idx) => ({
          id: `custom-${m.code}`,
          label: m.name,
          href: `/custom/${m.code}`,
          iconKey: 'custom-item',
          isCustom: true,
          customIndex: idx,
        }))
      : [];

    return [...builtIn, ...dynamicCustom];
  }, [enabledModules, customModules, hasPermission]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass-panel flex items-center gap-3 rounded-2xl px-5 py-3">
          <span className="h-3 w-3 animate-pulse rounded-full bg-brand-gradient" />
          <span className="text-sm font-medium text-slate-700">Memuat EISD One...</span>
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="aurora-hero relative flex min-h-screen flex-col overflow-x-clip">
      {/* Bola cahaya ambient hijau–ungu lembut di latar belakang */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-28 -left-24 h-[28rem] w-[28rem] rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="absolute top-10 -right-24 h-[30rem] w-[30rem] rounded-full bg-violet-500/25 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/4 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="absolute right-1/4 -bottom-16 h-96 w-96 rounded-full bg-purple-400/20 blur-3xl" />
      </div>

      {/* Slim Glass Top Bar ala Odoo */}
      <header className="glass-topbar sticky top-0 z-20 flex h-14 items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold tracking-tight text-slate-900">
            EISD <span className="text-brand-gradient">One</span>
          </span>
          {activePeriod && (
            <Badge variant="purple" className="hidden sm:inline-flex">
              Periode {activePeriod}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {pendingApprovals > 0 && (
            <Link
              href="/kpi"
              className="glass-tile relative flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-violet-800 transition hover:bg-white/95"
              title="Persetujuan tertunda"
            >
              <Bell className="h-3.5 w-3.5 text-violet-600" />
              <span>{pendingApprovals}</span>
            </Link>
          )}
          <Link
            href="/calendar"
            className="glass-tile flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-white/95 hover:text-emerald-600"
            title="Kalender EISD"
          >
            <CalendarDays className="h-3.5 w-3.5" />
          </Link>
          <div className="glass-tile hidden items-center gap-2 rounded-full py-1 pr-3 pl-1 sm:flex">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-bold text-white">
              {getInitials(user.fullName)}
            </span>
            <div className="leading-tight">
              <p className="text-[11.5px] font-semibold text-slate-900">{user.fullName}</p>
              <p className="text-[10px] text-slate-500">{user.roles[0]?.name ?? 'Pengurus'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="glass-tile flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
            title="Keluar"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Center Odoo-Style App Grid */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="grid w-full max-w-4xl grid-cols-3 gap-x-5 gap-y-8 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {allApps.map((app) => (
            <Link
              key={app.id}
              href={app.href}
              className="group flex flex-col items-center text-center focus:outline-none"
            >
              <div className="glass-panel relative flex h-[78px] w-[78px] items-center justify-center rounded-[22px] transition-all duration-200 group-hover:-translate-y-1.5 group-hover:scale-[1.04] group-hover:border-white group-hover:bg-white/80 group-hover:shadow-[0_18px_36px_-12px_rgba(124,58,237,0.34),0_8px_18px_-8px_rgba(16,185,129,0.28)] group-focus-visible:ring-4 group-focus-visible:ring-violet-500/25">
                <AppModuleIcon iconKey={app.iconKey} index={app.customIndex} />
                {app.isCustom && (
                  <span
                    title="Custom Module"
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-bold text-white shadow-sm"
                  >
                    ✦
                  </span>
                )}
              </div>
              <span className="mt-2.5 max-w-[110px] truncate text-[12.5px] font-medium text-slate-700 transition group-hover:font-semibold group-hover:text-violet-800">
                {app.label}
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
