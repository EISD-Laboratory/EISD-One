'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, ChevronRight, LayoutGrid, LogOut, Settings } from 'lucide-react';
import { useAuth } from './auth-context';
import { apiFetch } from './client-api';
import { Badge } from './ui';

const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/members': 'Anggota',
  '/members/import': 'Import Excel / CSV',
  '/kpi': 'KPI Anggota',
  '/calendar': 'Kalender',
  '/core': 'Core — Kas & Aset',
  '/event': 'Event',
  '/praktikum': 'Praktikum',
  '/enabler': 'Enabler',
  '/media': 'Media',
  '/competition': 'Competition',
  '/research': 'Research & Community',
  '/study-group': 'Study Group',
  '/periods': 'Periode & Modul',
  '/custom-modules': 'Custom Module',
  '/rbac': 'RBAC & Akun',
  '/audit-logs': 'Audit Log',
  '/settings': 'Pengaturan',
};

interface CustomModuleSummary {
  code: string;
  name: string;
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
  const [customModules, setCustomModules] = useState<CustomModuleSummary[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !pathname.startsWith('/custom/')) return;
    void apiFetch<CustomModuleSummary[]>('/api/custom-modules')
      .then(setCustomModules)
      .catch(() => setCustomModules([]));
  }, [user, pathname]);

  const breadcrumbLabel = useMemo(() => {
    if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
    if (pathname.startsWith('/members/') && pathname !== '/members/import') {
      return 'Anggota / Detail Profil';
    }
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

  const isFullBleedPage = pathname === '/members';

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      {/* Bola cahaya ambient lembut hijau–ungu di belakang seluruh lapisan glass */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="absolute top-12 right-[-6rem] h-[28rem] w-[28rem] rounded-full bg-violet-400/25 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-80 w-80 rounded-full bg-purple-300/25 blur-3xl" />
      </div>

      {/* Topbar Glassmorphism ala Odoo (tanpa sidebar) */}
      <header className="glass-topbar sticky top-0 z-20 flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5 text-xs font-medium text-slate-600">
          <Link
            href="/apps"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-[0_6px_16px_-4px_rgba(124,58,237,0.5)] transition hover:brightness-110"
            title="Kembali ke App Launcher (Semua Aplikasi)"
          >
            <LayoutGrid className="h-4 w-4" />
          </Link>
          <Link
            href="/apps"
            className="hidden text-sm font-bold tracking-tight text-slate-900 hover:text-violet-700 sm:inline"
          >
            EISD <span className="text-brand-gradient">One</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate text-sm font-semibold text-slate-900">{breadcrumbLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/calendar"
            className="glass-tile flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-white/95 hover:text-emerald-600"
            title="Kalender EISD"
          >
            <CalendarDays className="h-3.5 w-3.5" />
          </Link>
          {hasPermission('settings.system.read') && (
            <Link
              href="/settings"
              className="glass-tile flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-white/95 hover:text-violet-600"
              title="Pengaturan"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          )}
          <div className="glass-tile hidden items-center gap-2 rounded-full py-1 pr-3 pl-1 md:flex">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-bold text-white">
              {getInitials(user.fullName)}
            </span>
            <span className="max-w-[130px] truncate text-xs font-semibold text-slate-800">
              {user.fullName}
            </span>
            {user.roles[0] && (
              <Badge variant={user.roles[0].code === 'super_admin' ? 'default' : 'purple'}>
                {user.roles[0].name}
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="glass-tile flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-slate-700 transition hover:bg-rose-50 hover:text-rose-600"
            title="Keluar"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
          <button
            type="button"
            onClick={() => void logoutAll()}
            className="hidden text-[11px] text-slate-400 hover:text-slate-700 lg:inline"
            title="Keluar dari semua perangkat"
          >
            Semua
          </button>
        </div>
      </header>

      {/* Konten Utama Penuh (tanpa sidebar global; /members memakai full-bleed untuk filter sidebar kiri) */}
      <main
        className={
          isFullBleedPage
            ? 'w-full flex-1'
            : 'mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8'
        }
      >
        {children}
      </main>
    </div>
  );
}
