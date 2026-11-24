'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
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
  divisionStats: Array<{
    code: string;
    name: string;
    shortLabel: string;
    memberCount: number;
    headCount: number;
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
    location: string | null;
    status: string;
    isPublicOpen: boolean;
    participantCount: number;
  }>;
  recentActivities: Array<{
    id: string;
    actorEmail: string | null;
    action: string;
    module: string;
    entityType: string;
    createdAt: string;
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins} mnt lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  return `${days} hari lalu`;
}

function formatCompactRupiah(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `Rp ${(n / 1_000_000).toFixed(2).replace(/\.00$/, '')} jt`;
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function RoleDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBarIdx, setActiveBarIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'calendar' | 'events' | 'modules'>('calendar');

  useEffect(() => {
    void apiFetch<DashboardData>('/api/dashboard')
      .then((res) => {
        setData(res);
        // Pilih bar dengan anggota terbanyak sebagai sorotan awal
        if (res.divisionStats?.length) {
          let maxIdx = 0;
          res.divisionStats.forEach((d, idx) => {
            if (d.memberCount > res.divisionStats[maxIdx].memberCount) maxIdx = idx;
          });
          setActiveBarIdx(maxIdx);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal memuat dashboard.'));
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-64 animate-pulse rounded-xl bg-slate-200/70" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  const firstName = user?.fullName?.split(' ')[0] || 'Pengurus';
  const roleBadgeLabel =
    data.roleView === 'ADMIN'
      ? 'Administrator · Akses Penuh'
      : data.roleView === 'CORE'
        ? 'Pengurus Core'
        : `Kadiv ${data.userDivisions.map((d) => d.name).join(', ') || 'Divisi'}`;

  const maxDivMembers = Math.max(1, ...(data.divisionStats?.map((d) => d.memberCount) ?? [1]));
  const totalDivMembers = Math.max(
    1,
    (data.divisionStats ?? []).reduce((acc, d) => acc + d.memberCount, 0),
  );
  const highlightedDiv = data.divisionStats[activeBarIdx] ?? data.divisionStats[0];

  const kpiCards = [
    {
      label: data.roleView === 'KADIV' ? 'Anggota Aktif Divisi' : 'Total Anggota Aktif',
      value: String(data.stats.activeMemberCount),
      href: '/members',
      aurora: 'aurora-card-purple',
      icon: Users,
      iconColor: 'text-violet-600',
    },
    data.stats.cashBalance !== null
      ? {
          label: 'Saldo Kas Core',
          value: formatCompactRupiah(data.stats.cashBalance),
          href: '/core',
          aurora: 'aurora-card-green',
          icon: Wallet,
          iconColor: 'text-emerald-600',
        }
      : {
          label: 'Agenda 30 Hari',
          value: String(data.upcomingCalendar.length),
          href: '/calendar',
          aurora: 'aurora-card-green',
          icon: CalendarDays,
          iconColor: 'text-emerald-600',
        },
    {
      label: 'Modul Aktif',
      value: `${data.stats.enabledModuleCount}/${data.stats.totalModuleCount}`,
      href: '/periods',
      aurora: 'aurora-card-blend',
      icon: Layers,
      iconColor: 'text-teal-600',
    },
    data.roleView !== 'KADIV'
      ? {
          label: 'Menunggu Approval',
          value: String(data.stats.pendingApprovals),
          href: '/kpi',
          aurora: 'aurora-card-orchid',
          icon: CheckCircle2,
          iconColor: 'text-purple-600',
        }
      : {
          label: 'Event Mendatang',
          value: String(data.upcomingEvents.length),
          href: '/event',
          aurora: 'aurora-card-orchid',
          icon: Sparkles,
          iconColor: 'text-purple-600',
        },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting Header ala Referensi */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {getGreeting()}, <span className="text-brand-gradient">{firstName}!</span>
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Periode kepengurusan aktif:{' '}
            <strong className="text-slate-700">{data.activePeriod?.name ?? 'Belum diset'}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.roleView === 'ADMIN' ? 'default' : 'purple'}>{roleBadgeLabel}</Badge>
          {data.stats.customModulesCount > 0 && (
            <Badge variant="success">{data.stats.customModulesCount} Custom Modul</Badge>
          )}
        </div>
      </div>

      {/* Row 1: Aurora Frosted Glass KPI Cards (Hijau × Ungu) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`glass-panel group relative overflow-hidden rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-white ${card.aurora}`}
            >
              {/* Dekorasi sparkle halus ala kartu referensi */}
              <Sparkles
                className="pointer-events-none absolute top-7 right-24 h-3.5 w-3.5 text-white/85"
                aria-hidden="true"
              />
              <div className="relative flex items-start justify-between">
                <span className="glass-tile flex h-10 w-10 items-center justify-center rounded-xl">
                  <Icon className={`h-4 w-4 ${card.iconColor}`} />
                </span>
                <Link
                  href={card.href}
                  className="glass-tile rounded-full px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-white/95 hover:text-violet-700"
                >
                  Lihat detail
                </Link>
              </div>
              <div className="relative mt-6">
                <p className="text-2xl font-bold tracking-tight text-slate-900">{card.value}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-600">{card.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 2: Grafik Sebaran Divisi (Green-Purple Gradient Bars) + Aktivitas Terbaru */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient-soft text-violet-700 backdrop-blur-sm">
                <BarChart3 className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>Sebaran Anggota & Modul Divisi</CardTitle>
                <p className="text-xs text-slate-500">
                  Klik atau arahkan kursor ke batang divisi untuk melihat rincian
                </p>
              </div>
            </div>
            {highlightedDiv && (
              <div className="glass-dark rounded-xl px-3 py-2 text-right text-white">
                <p className="text-[10.5px] font-medium text-slate-300">{highlightedDiv.name}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-violet-400" />
                    {highlightedDiv.memberCount} anggota
                  </span>
                  <span className="text-emerald-400">
                    {Math.round((highlightedDiv.memberCount / totalDivMembers) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex h-52 items-end gap-2.5 border-b border-slate-100 pb-3 sm:gap-4">
              {data.divisionStats.map((d, idx) => {
                const isSelected = idx === activeBarIdx;
                const memberH = Math.max(16, Math.round((d.memberCount / maxDivMembers) * 100));
                const headH = Math.max(
                  10,
                  Math.round(((d.headCount + (d.isEnabled ? 1 : 0)) / (maxDivMembers + 1)) * 80),
                );
                return (
                  <button
                    key={d.code}
                    type="button"
                    onMouseEnter={() => setActiveBarIdx(idx)}
                    onClick={() => setActiveBarIdx(idx)}
                    className="group flex h-full flex-1 flex-col items-center justify-end gap-2 focus:outline-none"
                  >
                    <div className="flex h-full w-full items-end justify-center gap-1">
                      <span
                        style={{ height: `${memberH}%` }}
                        className={`w-3.5 rounded-t-lg transition-all duration-300 sm:w-4 ${
                          isSelected
                            ? 'bg-gradient-to-t from-violet-600 to-purple-400 shadow-[0_6px_16px_-4px_rgba(124,58,237,0.55)]'
                            : 'bg-slate-200/80 group-hover:bg-violet-200'
                        }`}
                      />
                      <span
                        style={{ height: `${headH}%` }}
                        className={`w-3.5 rounded-t-lg transition-all duration-300 sm:w-4 ${
                          isSelected
                            ? 'bg-gradient-to-t from-emerald-500 to-teal-300 shadow-[0_6px_16px_-4px_rgba(16,185,129,0.5)]'
                            : 'bg-slate-100 group-hover:bg-emerald-200'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 flex items-center gap-2.5 sm:gap-4">
              {data.divisionStats.map((d, idx) => (
                <span
                  key={d.code}
                  className={`flex-1 text-center text-[11px] font-semibold ${
                    idx === activeBarIdx ? 'text-violet-700' : 'text-slate-400'
                  }`}
                >
                  {d.shortLabel}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 text-[11.5px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                Jumlah Anggota
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Status Aktif & Koordinator
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right Card: Aktivitas Terbaru (Recent Activities ala referensi) */}
        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Activity className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>Aktivitas Terbaru</CardTitle>
                <p className="text-xs text-slate-500">Rekaman terbaru dari Audit Log sistem</p>
              </div>
            </div>
            <Link
              href="/audit-logs"
              className="text-xs font-semibold text-violet-700 hover:underline"
            >
              Semua
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {data.recentActivities.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada aktivitas terekam.</p>
            ) : (
              data.recentActivities.map((act, idx) => {
                const emailLabel = (act.actorEmail || 'Sistem').split('@')[0];
                const avatarStyle =
                  idx % 2 === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-violet-100 text-violet-800';
                return (
                  <div
                    key={act.id}
                    className="flex items-center justify-between gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarStyle}`}
                      >
                        {emailLabel.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs text-slate-700">
                          <strong className="font-semibold text-slate-900">{emailLabel}</strong>{' '}
                          <span className="text-slate-500">menjalankan</span>{' '}
                          <span className="rounded-md bg-violet-50 px-1.5 py-0.5 font-medium text-violet-700">
                            {act.action}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          Modul /{act.module} · {act.entityType}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatRelativeTime(act.createdAt)}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Tabel Operasional Bertab ala "Assigned to Me" */}
      <Card>
        <CardHeader className="flex flex-col gap-3 border-b border-white/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Ringkasan Operasional Lab</CardTitle>
            <p className="text-xs text-slate-600">
              Pantau agenda terdekat, event terbuka, dan status seluruh modul divisi
            </p>
          </div>
          <div className="glass-tile inline-flex rounded-xl p-1 text-xs font-medium">
            {[
              { id: 'calendar', label: `Agenda (${data.upcomingCalendar.length})` },
              { id: 'events', label: `Event (${data.upcomingEvents.length})` },
              { id: 'modules', label: `Modul (${data.divisions.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as 'calendar' | 'events' | 'modules')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  activeTab === tab.id
                    ? 'bg-white/90 font-semibold text-violet-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto pt-3">
          {activeTab === 'calendar' && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400">
                  <th className="py-2.5 pr-4">Agenda</th>
                  <th className="py-2.5 pr-4">Kategori</th>
                  <th className="py-2.5 pr-4">Lokasi</th>
                  <th className="py-2.5 text-right">Jadwal (WIB)</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingCalendar.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-slate-400">
                      Belum ada agenda dalam 30 hari ke depan.
                    </td>
                  </tr>
                ) : (
                  data.upcomingCalendar.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100/80 last:border-0">
                      <td className="py-3 pr-4 font-medium text-slate-900">{item.title}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={item.category === 'EVENT' ? 'purple' : 'success'}>
                          ● {item.category}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500">{item.location || '-'}</td>
                      <td className="py-3 text-right text-xs font-medium text-slate-600">
                        {new Date(item.startAt).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: 'Asia/Jakarta',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'events' && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400">
                  <th className="py-2.5 pr-4">Nama Kegiatan</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4">Peserta</th>
                  <th className="py-2.5 pr-4">Tanggal</th>
                  <th className="py-2.5 text-right">Form Publik</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                      Belum ada event mendatang.
                    </td>
                  </tr>
                ) : (
                  data.upcomingEvents.map((ev) => (
                    <tr key={ev.id} className="border-b border-slate-100/80 last:border-0">
                      <td className="py-3 pr-4 font-medium text-slate-900">{ev.title}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={ev.status === 'APPROVED' ? 'success' : 'purple'}>
                          ● {ev.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-600">
                        {ev.participantCount} pendaftar
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500">
                        {new Date(ev.startAt).toLocaleDateString('id-ID', {
                          dateStyle: 'medium',
                          timeZone: 'Asia/Jakarta',
                        })}
                      </td>
                      <td className="py-3 text-right">
                        {ev.isPublicOpen ? (
                          <Link
                            href={`/register/${ev.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            Buka Form <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">Tertutup</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'modules' && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400">
                  <th className="py-2.5 pr-4">Modul / Divisi</th>
                  <th className="py-2.5 pr-4">Tipe</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4">Kesiapan</th>
                  <th className="py-2.5 text-right">Akses</th>
                </tr>
              </thead>
              <tbody>
                {data.divisions.map((d) => {
                  const href = d.isCustom
                    ? `/custom/${d.code}`
                    : BUILTIN_PATHS[d.code] || '/members';
                  const pct = d.isEnabled ? 100 : 20;
                  return (
                    <tr key={d.id} className="border-b border-slate-100/80 last:border-0">
                      <td className="py-3 pr-4 font-medium text-slate-900">{d.name}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={d.isCustom ? 'purple' : 'secondary'}>
                          {d.isCustom ? 'Custom' : 'Bawaan'}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={d.isEnabled ? 'success' : 'danger'}>
                          ● {d.isEnabled ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              style={{ width: `${pct}%` }}
                              className="h-full rounded-full bg-brand-gradient"
                            />
                          </div>
                          <span className="text-xs text-slate-500">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={href}
                          className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                        >
                          Buka →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
