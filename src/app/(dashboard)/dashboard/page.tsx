'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface DashboardData {
  roleView: 'ADMIN' | 'CORE' | 'KADIV';
  activePeriod: { id: string; name: string } | null;
  userDivisions: Array<{ id: string; code: string; name: string; isEnabled: boolean }>;
  stats: {
    activeMemberCount: number;
    enabledModuleCount: number;
    totalModuleCount: number;
    customModulesCount: number;
    cashBalance: number | null;
    pendingApprovals: number;
    pendingKpiManual: number;
    pendingRecognitions: number;
  };
  divisions: Array<{
    id: string;
    code: string;
    name: string;
    isCustom: boolean;
    isEnabled: boolean;
  }>;
  upcomingCalendar: Array<{
    id: string;
    title: string;
    category: string;
    startAt: string;
    location: string | null;
  }>;
  upcomingEvents: Array<{
    id: string;
    slug: string;
    title: string;
    startAt: string;
    status: string;
    isPublicOpen: boolean;
  }>;
}

const BUILTIN_PATHS: Record<string, string> = {
  core: '/core',
  event: '/event',
  praktikum: '/praktikum',
  enabler: '/enabler',
  media: '/media',
  competition: '/competition',
  research: '/research',
  'study-group': '/study-group',
};

export default function RoleDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<DashboardData>('/api/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal memuat dashboard.'));
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Memuat ringkasan dashboard...</p>;
  }

  const fmtRupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(n);

  const roleBadgeLabel =
    data.roleView === 'ADMIN'
      ? 'Administrator — Akses Penuh'
      : data.roleView === 'CORE'
        ? 'Pengurus Core'
        : `Kadiv ${data.userDivisions.map((d) => d.name).join(', ') || 'Divisi'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Halo, {user?.fullName}</h1>
          <p className="text-sm text-slate-500">
            Periode aktif: <strong>{data.activePeriod?.name ?? 'Belum diset'}</strong>
          </p>
        </div>
        <Badge variant={data.roleView === 'ADMIN' ? 'default' : 'secondary'}>
          {roleBadgeLabel}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-slate-500">
              {data.roleView === 'KADIV' ? 'Anggota Aktif Divisi' : 'Total Anggota Aktif'}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{data.stats.activeMemberCount}</p>
            <Link href="/members" className="mt-2 inline-block text-xs text-slate-600 underline">
              Lihat direktori →
            </Link>
          </CardContent>
        </Card>

        {data.stats.cashBalance !== null ? (
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-medium text-slate-500">Saldo Kas Core</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {fmtRupiah(data.stats.cashBalance)}
              </p>
              <Link href="/core" className="mt-2 inline-block text-xs text-slate-600 underline">
                Buka Kas & Aset →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-medium text-slate-500">Agenda 30 Hari ke Depan</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {data.upcomingCalendar.length}
              </p>
              <Link href="/calendar" className="mt-2 inline-block text-xs text-slate-600 underline">
                Buka Kalender →
              </Link>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-slate-500">Modul Aktif</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {data.stats.enabledModuleCount} / {data.stats.totalModuleCount}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Termasuk {data.stats.customModulesCount} custom module
            </p>
          </CardContent>
        </Card>

        {data.roleView !== 'KADIV' ? (
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-medium text-slate-500">Menunggu Persetujuan</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {data.stats.pendingApprovals}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                KPI: {data.stats.pendingKpiManual} · Apresiasi: {data.stats.pendingRecognitions}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-medium text-slate-500">Penilaian KPI</p>
              <p className="mt-1 text-base font-semibold text-slate-900">Siap Diinput</p>
              <Link href="/kpi" className="mt-2 inline-block text-xs text-slate-600 underline">
                Buka Modul KPI →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agenda Terdekat (30 Hari)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.upcomingCalendar.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada agenda dalam 30 hari ke depan.</p>
            ) : (
              data.upcomingCalendar.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(item.startAt).toLocaleString('id-ID', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Asia/Jakarta',
                      })}
                      {item.location ? ` · ${item.location}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary">{item.category}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pintasan Modul Aktif</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {data.divisions
                .filter((d) => d.isEnabled)
                .map((d) => {
                  const href = d.isCustom
                    ? `/custom/${d.code}`
                    : BUILTIN_PATHS[d.code] || '/members';
                  return (
                    <Link
                      key={d.id}
                      href={href}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-900 hover:text-white"
                    >
                      {d.name} {d.isCustom ? '✦' : ''}
                    </Link>
                  );
                })}
            </div>

            {data.upcomingEvents.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Event Mendatang
                </p>
                <div className="space-y-2">
                  {data.upcomingEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between gap-2 text-xs text-slate-700"
                    >
                      <span className="truncate font-medium">{ev.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary">{ev.status}</Badge>
                        {ev.isPublicOpen && (
                          <Link
                            href={`/register/${ev.slug}`}
                            className="text-slate-900 underline"
                            target="_blank"
                          >
                            Form Publik
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
