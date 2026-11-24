'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Award,
  Blocks,
  BookOpen,
  CalendarDays,
  ChevronRight,
  FileSpreadsheet,
  FlaskConical,
  GraduationCap,
  Handshake,
  Home,
  LayoutDashboard,
  Layers,
  LogOut,
  Megaphone,
  Palette,
  Plus,
  Puzzle,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
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

const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/members': 'Direktori Anggota',
  '/members/import': 'Import Excel / CSV',
  '/kpi': 'KPI Anggota',
  '/calendar': 'Kalender EISD',
  '/core': 'Core — Kas, Aset & Arsip',
  '/event': 'Event & Kuliah Umum',
  '/praktikum': 'Praktikum',
  '/enabler': 'Enabler & Apresiasi',
  '/media': 'Media & Publikasi',
  '/competition': 'Competition',
  '/research': 'Research & Community',
  '/study-group': 'Study Group',
  '/periods': 'Periode & Modul',
  '/custom-modules': 'Custom Module Builder',
  '/rbac': 'RBAC & Akun Pengurus',
  '/audit-logs': 'Audit Log',
  '/settings': 'Pengaturan Sistem',
};

interface CustomModuleSummary {
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

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout, logoutAll, hasPermission } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [enabledModules, setEnabledModules] = useState<Set<string> | null>(null);
  const [totalModules, setTotalModules] = useState(8);
  const [customModules, setCustomModules] = useState<CustomModuleSummary[]>([]);
  const [navSearch, setNavSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    void apiFetch<Array<{ code: string; isEnabled: boolean }>>('/api/divisions')
      .then((divs) => {
        setTotalModules(divs.length || 8);
        setEnabledModules(new Set(divs.filter((d) => d.isEnabled).map((d) => d.code)));
      })
      .catch(() => setEnabledModules(null));

    void apiFetch<CustomModuleSummary[]>('/api/custom-modules')
      .then((mods) => setCustomModules(mods.filter((m) => m.division?.isEnabled)))
      .catch(() => setCustomModules([]));
  }, [user, pathname]);

  const query = navSearch.trim().toLowerCase();

  const breadcrumbLabel = useMemo(() => {
    if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
    if (pathname.startsWith('/custom/')) {
      const code = pathname.replace('/custom/', '');
      const found = customModules.find((m) => m.code === code);
      return found ? found.name : `Custom: ${code}`;
    }
    return 'Workspace';
  }, [pathname, customModules]);

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

  const filterItem = (item: { label: string; permission?: string }) => {
    if (item.permission && !hasPermission(item.permission)) return false;
    if (query && !item.label.toLowerCase().includes(query)) return false;
    return true;
  };

  const renderLinks = (
    items: Array<{ href: string; label: string; permission?: string; icon: typeof Users }>,
  ) =>
    items.filter(filterItem).map((item) => {
      const Icon = item.icon;
      const active =
        pathname === item.href ||
        (item.href !== '/members' && item.href !== '/dashboard' && pathname.startsWith(item.href));
      return (
        <Link
          key={item.href}
          href={item.href}
          className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] font-medium transition-all ${
            active
              ? 'glass-tile text-slate-900 ring-1 ring-violet-300/60'
              : 'text-slate-600 hover:bg-white/55 hover:text-slate-900'
          }`}
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all ${
              active
                ? 'bg-brand-gradient text-white shadow-sm'
                : 'bg-white/65 text-slate-500 ring-1 ring-white/80 group-hover:bg-violet-50/90 group-hover:text-violet-700'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{item.label}</span>
        </Link>
      );
    });

  const visibleCore = CORE_NAV.filter(filterItem);
  const visibleModules = MODULE_NAV.filter(
    (m) => (!enabledModules || enabledModules.has(m.code)) && filterItem(m),
  );
  const visibleCustomLinks = hasPermission('custom_module.record.read')
    ? customModules
        .map((m) => ({ href: `/custom/${m.code}`, label: m.name, icon: Puzzle }))
        .filter(filterItem)
    : [];
  const visibleAdmin = ADMIN_NAV.filter(filterItem);

  const enabledCount = enabledModules ? enabledModules.size : totalModules;
  const totalTicks = 16;
  const filledTicks = Math.max(
    1,
    Math.min(totalTicks, Math.round((enabledCount / Math.max(1, totalModules)) * totalTicks)),
  );

  return (
    <div className="relative flex min-h-screen overflow-x-clip">
      {/* Bola cahaya ambient lembut hijau–ungu di belakang seluruh lapisan glass */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="absolute top-12 right-[-6rem] h-[28rem] w-[28rem] rounded-full bg-violet-400/25 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-80 w-80 rounded-full bg-purple-300/25 blur-3xl" />
      </div>

      {/* Sidebar Glassmorphism (Light Frosted + Green-Purple Accent) */}
      <aside className="glass-sidebar flex w-[264px] shrink-0 flex-col">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-[0_6px_16px_-4px_rgba(124,58,237,0.5)]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <span className="block text-[15px] font-bold tracking-tight text-slate-900">
                EISD One
              </span>
              <span className="block text-[11px] font-medium text-slate-400">
                Lab EISD Platform
              </span>
            </div>
          </Link>
          <Badge variant="purple" className="text-[10px]">
            v1.0
          </Badge>
        </div>

        {/* Search Input (terinspirasi dari referensi) */}
        <div className="px-4 pb-3">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              placeholder="Cari menu..."
              className="w-full rounded-xl border border-slate-200/90 bg-slate-100/70 py-1.5 pr-8 pl-8 text-xs text-slate-700 placeholder:text-slate-400 focus:bg-white"
            />
            <span className="pointer-events-none absolute right-2.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              /
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {visibleCore.length > 0 && (
            <div className="space-y-1">
              <p className="px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                Utama
              </p>
              {renderLinks(visibleCore)}
            </div>
          )}

          {visibleModules.length > 0 && (
            <div className="space-y-1">
              <p className="px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                Modul Divisi
              </p>
              {renderLinks(visibleModules)}
            </div>
          )}

          {visibleCustomLinks.length > 0 && (
            <div className="space-y-1">
              <p className="px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                Custom Module
              </p>
              {renderLinks(visibleCustomLinks)}
            </div>
          )}

          {visibleAdmin.length > 0 && (
            <div className="space-y-1">
              <p className="px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                Administrasi
              </p>
              {renderLinks(visibleAdmin)}
            </div>
          )}
        </nav>

        {/* Bottom Segmented Meter Widget + User Strip */}
        <div className="space-y-3 border-t border-white/60 p-3.5">
          <div className="glass-tile rounded-xl p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Modul Aktif</span>
              <span className="font-semibold text-violet-700">
                {enabledCount}/{totalModules}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1" aria-hidden="true">
              {Array.from({ length: totalTicks }).map((_, idx) => {
                const filled = idx < filledTicks;
                const ratio = idx / (totalTicks - 1);
                const barColor = !filled
                  ? 'bg-slate-200/70'
                  : ratio < 0.45
                    ? 'bg-emerald-500'
                    : ratio < 0.72
                      ? 'bg-teal-500'
                      : 'bg-violet-500';
                return <span key={idx} className={`h-4 flex-1 rounded-full ${barColor}`} />;
              })}
            </div>
            {hasPermission('custom_module.manage') && (
              <Link
                href="/custom-modules"
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/80 bg-brand-gradient-soft py-1.5 text-[11.5px] font-semibold text-violet-900 backdrop-blur-sm transition hover:brightness-95"
              >
                <Sparkles className="h-3 w-3 text-emerald-600" />
                Buat Custom Module
              </Link>
            )}
          </div>

          <div className="glass-tile rounded-xl p-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white shadow-sm">
                {getInitials(user.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900">{user.fullName}</p>
                <p className="truncate text-[11px] text-slate-600">
                  {user.roles[0]?.name ?? user.email}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void logout()}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/80 bg-white/60 py-1.5 text-[11.5px] font-medium text-slate-700 backdrop-blur-sm hover:bg-white/90"
              >
                <LogOut className="h-3 w-3" /> Keluar
              </button>
              <button
                type="button"
                onClick={() => void logoutAll()}
                title="Keluar dari semua perangkat"
                className="rounded-lg border border-white/80 bg-white/60 px-2 py-1.5 text-[11px] text-slate-600 backdrop-blur-sm hover:bg-white/90 hover:text-slate-900"
              >
                Semua
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area with Crisp Glass Top Header */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-topbar sticky top-0 z-20 flex h-14 items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <Link
              href="/dashboard"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white/70 hover:text-slate-800"
            >
              <Home className="h-3.5 w-3.5" />
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-semibold text-slate-900">{breadcrumbLabel}</span>
          </div>

          <div className="flex items-center gap-2.5">
            {hasPermission('member.member.read') && (
              <Link
                href="/members"
                className="glass-tile hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white/90 hover:text-violet-700 sm:inline-flex"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-600" />
                Kelola Anggota
              </Link>
            )}
            <Link
              href="/calendar"
              className="glass-tile flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-white/90 hover:text-emerald-600"
              title="Kalender EISD"
            >
              <CalendarDays className="h-3.5 w-3.5" />
            </Link>
            {hasPermission('settings.system.read') && (
              <Link
                href="/settings"
                className="glass-tile flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-white/90 hover:text-violet-600"
                title="Pengaturan"
              >
                <Settings className="h-3.5 w-3.5" />
              </Link>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-bold text-white ring-2 ring-white/80 shadow-sm">
              {getInitials(user.fullName)}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
