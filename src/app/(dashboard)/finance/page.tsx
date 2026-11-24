'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Box,
  Check,
  CheckCheck,
  Download,
  FileSpreadsheet,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { useBreadcrumb } from '@/components/app-shell';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { FinanceAnalyticsCharts, type FinanceAnalyticsData } from '@/components/finance-charts';
import { FieldGroup, GlassConfirmDialog, GlassSelect } from '@/components/glass-inputs';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface KasPaymentCell {
  id: string;
  amount: number;
  paidAt: string;
  notes: string | null;
}

interface KasTrackerMember {
  id: string;
  nim: string;
  fullName: string;
  generation: string | null;
  divisionName: string;
  positionTitle: string;
  payments: Record<number, KasPaymentCell>;
  paidMonths: number;
  totalPaid: number;
}

interface CoreFinanceData {
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    incomeCount: number;
    expenseCount: number;
    assetCount: number;
  };
  filteredSummary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    count: number;
  };
  meta: {
    categories: string[];
    sourceModules: string[];
    availableYears: number[];
  };
  analytics: FinanceAnalyticsData;
  kasTracker: {
    year: number;
    monthlyFee: number;
    currentMonth: number;
    summary: {
      totalActiveMembers: number;
      currentMonthPaidCount: number;
      currentMonthTarget: number;
      currentMonthCollected: number;
      annualTarget: number;
      annualCollected: number;
      annualPaidSlots: number;
      annualTotalSlots: number;
    };
    members: KasTrackerMember[];
  };
  transactions: Array<{
    id: string;
    type: 'INCOME' | 'EXPENSE';
    category: string;
    description: string;
    amount: number;
    transactionDate: string;
    sourceModule: string | null;
  }>;
  assets: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    condition: string;
    location: string | null;
    quantity: number;
  }>;
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agt',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

const MONTH_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

export default function FinancePage() {
  const { hasPermission } = useAuth();
  const { setExtraCrumbs } = useBreadcrumb();
  const canManage = hasPermission('core.finance.manage');

  const currentYear = new Date().getFullYear();
  const currentMonthDefault = new Date().getMonth() + 1;

  const [data, setData] = useState<CoreFinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'analytics' | 'cash' | 'tracker' | 'assets'>('analytics');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Selected year for Analytics & Tracker Kas
  const [analyticsYear, setAnalyticsYear] = useState<number>(currentYear);

  // Transaction filters (server-backed)
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [txYearFilter, setTxYearFilter] = useState<string>('ALL');
  const [txMonthFilter, setTxMonthFilter] = useState<string>('ALL');
  const [txCategoryFilter, setTxCategoryFilter] = useState<string>('ALL');
  const [txSourceFilter, setTxSourceFilter] = useState<string>('ALL');
  const [txSearch, setTxSearch] = useState<string>('');

  // Kas Tracker local filters & view mode
  const [kasViewMode, setKasViewMode] = useState<'matrix' | 'monthly'>('matrix');
  const [kasSelectedMonth, setKasSelectedMonth] = useState<number>(currentMonthDefault);
  const [kasSearch, setKasSearch] = useState('');
  const [kasDivFilter, setKasDivFilter] = useState('ALL');
  const [kasGenFilter, setKasGenFilter] = useState('ALL');
  const [kasStatusFilter, setKasStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const [busyKasKey, setBusyKasKey] = useState<string | null>(null);

  // Confirmation dialogs
  const [deleteTxTarget, setDeleteTxTarget] = useState<{
    id: string;
    description: string;
    amount: number;
  } | null>(null);
  const [deletingTx, setDeletingTx] = useState(false);
  const [confirmBulkPay, setConfirmBulkPay] = useState(false);
  const [bulkPaying, setBulkPaying] = useState(false);

  // Forms
  const [txForm, setTxForm] = useState({
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    category: 'Operasional',
    description: '',
    amount: '',
    transactionDate: new Date().toISOString().slice(0, 10),
  });
  const [assetForm, setAssetForm] = useState({
    code: '',
    name: '',
    category: 'Elektronik',
    condition: 'GOOD',
    location: 'Ruang Lab EISD',
    quantity: '1',
  });

  const buildQueryString = useCallback(
    (extra?: Record<string, string>) => {
      const qs = new URLSearchParams();
      qs.set('analyticsYear', String(analyticsYear));
      if (txTypeFilter !== 'ALL') qs.set('type', txTypeFilter);
      if (txYearFilter !== 'ALL') qs.set('year', txYearFilter);
      if (txMonthFilter !== 'ALL') qs.set('month', txMonthFilter);
      if (txCategoryFilter !== 'ALL') qs.set('category', txCategoryFilter);
      if (txSourceFilter !== 'ALL') qs.set('sourceModule', txSourceFilter);
      if (txSearch.trim()) qs.set('search', txSearch.trim());
      if (extra) {
        for (const [k, v] of Object.entries(extra)) qs.set(k, v);
      }
      return qs.toString();
    },
    [
      analyticsYear,
      txTypeFilter,
      txYearFilter,
      txMonthFilter,
      txCategoryFilter,
      txSourceFilter,
      txSearch,
    ],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<CoreFinanceData>(`/api/modules/core?${buildQueryString()}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    const labelMap: Record<typeof tab, string> = {
      analytics: 'Analitik & Chart',
      cash: 'Kas & Transaksi',
      tracker: 'Tracker Kas Bulanan',
      assets: 'Inventaris Aset',
    };
    setExtraCrumbs([{ label: labelMap[tab] }]);
  }, [tab, setExtraCrumbs]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>([
      currentYear - 1,
      currentYear,
      currentYear + 1,
      ...(data?.meta.availableYears ?? []),
    ]);
    return Array.from(set)
      .sort((a, b) => b - a)
      .map((y) => ({ value: String(y), label: `Tahun ${y}` }));
  }, [currentYear, data?.meta.availableYears]);

  const hasActiveTxFilter =
    txTypeFilter !== 'ALL' ||
    txYearFilter !== 'ALL' ||
    txMonthFilter !== 'ALL' ||
    txCategoryFilter !== 'ALL' ||
    txSourceFilter !== 'ALL' ||
    txSearch.trim().length > 0;

  function resetTxFilters() {
    setTxTypeFilter('ALL');
    setTxYearFilter('ALL');
    setTxMonthFilter('ALL');
    setTxCategoryFilter('ALL');
    setTxSourceFilter('ALL');
    setTxSearch('');
  }

  async function addTx(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await apiFetch('/api/modules/core', {
        method: 'POST',
        body: JSON.stringify({ kind: 'transaction', ...txForm }),
      });
      setTxForm({ ...txForm, description: '', amount: '' });
      setMsg({ kind: 'ok', text: 'Transaksi kas berhasil dicatat.' });
      await load();
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Gagal mencatat transaksi.',
      });
    }
  }

  async function confirmDeleteTx() {
    if (!deleteTxTarget) return;
    setDeletingTx(true);
    setMsg(null);
    try {
      await apiFetch(`/api/modules/core?id=${encodeURIComponent(deleteTxTarget.id)}`, {
        method: 'DELETE',
      });
      setDeleteTxTarget(null);
      setMsg({ kind: 'ok', text: 'Transaksi berhasil dihapus.' });
      await load();
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus transaksi.',
      });
    } finally {
      setDeletingTx(false);
    }
  }

  async function handleToggleKas(member: KasTrackerMember, month: number) {
    if (!canManage) return;
    const isPaid = Boolean(member.payments[month]);
    const key = `${member.id}:${month}`;
    setBusyKasKey(key);
    setMsg(null);
    try {
      await apiFetch('/api/modules/core', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'kas_toggle',
          memberId: member.id,
          year: analyticsYear,
          month,
          paid: !isPaid,
        }),
      });
      setMsg({
        kind: 'ok',
        text: !isPaid
          ? `Kas ${MONTH_LONG[month - 1]} ${analyticsYear} untuk ${member.fullName} ditandai LUNAS (${rp(data?.kasTracker.monthlyFee ?? 15000)}).`
          : `Status kas ${MONTH_LONG[month - 1]} ${analyticsYear} untuk ${member.fullName} dibatalkan.`,
      });
      await load();
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Gagal memperbarui status kas.',
      });
    } finally {
      setBusyKasKey(null);
    }
  }

  // Filtered Kas Tracker members
  const kasDivisions = useMemo(() => {
    const s = new Set<string>();
    for (const m of data?.kasTracker.members ?? []) s.add(m.divisionName);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [data?.kasTracker.members]);

  const kasGenerations = useMemo(() => {
    const s = new Set<string>();
    for (const m of data?.kasTracker.members ?? []) {
      if (m.generation) s.add(m.generation);
    }
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [data?.kasTracker.members]);

  const filteredKasMembers = useMemo(() => {
    const list = data?.kasTracker.members ?? [];
    const q = kasSearch.trim().toLowerCase();
    return list.filter((m) => {
      if (kasDivFilter !== 'ALL' && m.divisionName !== kasDivFilter) return false;
      if (kasGenFilter !== 'ALL' && (m.generation || '') !== kasGenFilter) return false;
      if (q && !m.fullName.toLowerCase().includes(q) && !m.nim.toLowerCase().includes(q)) {
        return false;
      }
      if (kasViewMode === 'monthly') {
        const paidThisMonth = Boolean(m.payments[kasSelectedMonth]);
        if (kasStatusFilter === 'PAID' && !paidThisMonth) return false;
        if (kasStatusFilter === 'UNPAID' && paidThisMonth) return false;
      }
      return true;
    });
  }, [
    data?.kasTracker.members,
    kasSearch,
    kasDivFilter,
    kasGenFilter,
    kasViewMode,
    kasSelectedMonth,
    kasStatusFilter,
  ]);

  const unpaidInSelectedMonth = useMemo(
    () => filteredKasMembers.filter((m) => !m.payments[kasSelectedMonth]),
    [filteredKasMembers, kasSelectedMonth],
  );

  async function handleBulkPayMonth() {
    setBulkPaying(true);
    setMsg(null);
    try {
      const res = await apiFetch<{ markedCount: number; totalAmount: number }>(
        '/api/modules/core',
        {
          method: 'POST',
          body: JSON.stringify({
            kind: 'kas_bulk_pay',
            year: analyticsYear,
            month: kasSelectedMonth,
            memberIds: unpaidInSelectedMonth.map((m) => m.id),
          }),
        },
      );
      setConfirmBulkPay(false);
      setMsg({
        kind: 'ok',
        text: `${res.markedCount} anggota ditandai lunas untuk kas ${MONTH_LONG[kasSelectedMonth - 1]} ${analyticsYear} (+${rp(res.totalAmount)}).`,
      });
      await load();
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Gagal menandai lunas massal.',
      });
    } finally {
      setBulkPaying(false);
    }
  }

  async function addAsset(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await apiFetch('/api/modules/core', {
        method: 'POST',
        body: JSON.stringify({ kind: 'asset', ...assetForm }),
      });
      setAssetForm({ ...assetForm, code: '', name: '' });
      setMsg({ kind: 'ok', text: 'Aset inventaris baru berhasil ditambahkan.' });
      await load();
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Gagal menambah aset.',
      });
    }
  }

  const monthlyFee = data?.kasTracker.monthlyFee ?? 15000;
  const kasCurPct = useMemo(() => {
    const s = data?.kasTracker.summary;
    if (!s || s.totalActiveMembers === 0) return 0;
    return Math.round((s.currentMonthPaidCount / s.totalActiveMembers) * 100);
  }, [data?.kasTracker.summary]);

  const selectedMonthStats = useMemo(() => {
    const all = data?.kasTracker.members ?? [];
    const paid = all.filter((m) => Boolean(m.payments[kasSelectedMonth])).length;
    const total = all.length;
    const collected = all.reduce((acc, m) => acc + (m.payments[kasSelectedMonth]?.amount ?? 0), 0);
    const target = total * monthlyFee;
    return {
      paid,
      unpaid: Math.max(0, total - paid),
      total,
      collected,
      target,
      remaining: Math.max(0, target - collected),
      pct: total > 0 ? Math.round((paid / total) * 100) : 0,
    };
  }, [data?.kasTracker.members, kasSelectedMonth, monthlyFee]);

  const fullExcelUrl = `/api/modules/core?${buildQueryString({ export: 'xlsx', scope: 'full' })}`;
  const txExcelUrl = `/api/modules/core?${buildQueryString({ export: 'xlsx', scope: 'transactions' })}`;
  const kasExcelUrl = `/api/modules/core?${buildQueryString({ export: 'xlsx', scope: 'kas' })}`;
  const csvUrl = `/api/modules/core?${buildQueryString({ export: 'csv' })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Keuangan & Kas EISD</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Laporan analitik keuangan, buku kas pemasukan/pengeluaran, tracker iuran kas bulanan (
            {rp(monthlyFee)}/anggota), dan inventaris aset.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-36">
            <GlassSelect
              value={String(analyticsYear)}
              onChange={(v) => setAnalyticsYear(Number(v))}
              options={yearOptions}
            />
          </div>
          <a
            href={fullExcelUrl}
            className="btn-brand inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-sm"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel Lengkap (.xlsx)
          </a>
          <a
            href={csvUrl}
            className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/95"
          >
            <Download className="h-3.5 w-3.5 text-violet-600" /> CSV
          </a>
        </div>
      </div>

      {msg && (
        <div
          className={`rounded-2xl border px-4 py-2.5 text-sm backdrop-blur-sm ${
            msg.kind === 'ok'
              ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-800'
              : 'border-rose-200/80 bg-rose-50/80 text-rose-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* 4 Aurora KPI Cards */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="aurora-card-green">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Total Pemasukan</span>
                <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-emerald-600">
                  <ArrowDownLeft className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2.5 text-2xl font-bold text-emerald-700">
                {rp(data.summary.totalIncome)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {data.summary.incomeCount} transaksi masuk tercatat
              </p>
            </CardContent>
          </Card>

          <Card className="aurora-card-orchid">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Total Pengeluaran</span>
                <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-rose-600">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2.5 text-2xl font-bold text-rose-700">
                {rp(data.summary.totalExpense)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {data.summary.expenseCount} transaksi keluar tercatat
              </p>
            </CardContent>
          </Card>

          <Card className="aurora-card-blend">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Saldo Kas Bersih</span>
                <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-violet-600">
                  <Wallet className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2.5 text-2xl font-bold text-slate-900">{rp(data.summary.balance)}</p>
              <p className="mt-1 text-[11px] text-slate-500">Selisih kas aktif laboratorium EISD</p>
            </CardContent>
          </Card>

          <Card className="aurora-card-purple">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Kas {MONTH_SHORT[data.kasTracker.currentMonth - 1]} ({rp(monthlyFee)}/bln)
                </span>
                <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-emerald-600">
                  <Users className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                <p className="text-2xl font-bold text-slate-900">
                  {data.kasTracker.summary.currentMonthPaidCount}
                  <span className="text-sm font-medium text-slate-500">
                    /{data.kasTracker.summary.totalActiveMembers}
                  </span>
                </p>
                <span className="text-xs font-bold text-emerald-700">{kasCurPct}% Lunas</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/70">
                <div
                  className="bg-brand-gradient h-full rounded-full transition-all"
                  style={{ width: `${kasCurPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {rp(data.kasTracker.summary.currentMonthCollected)} /{' '}
                {rp(data.kasTracker.summary.currentMonthTarget)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="glass-tile inline-flex flex-wrap gap-1 rounded-xl p-1 text-xs font-medium">
        {[
          { id: 'analytics', label: 'Analitik & Chart', icon: BarChart3 },
          {
            id: 'cash',
            label: `Kas & Transaksi (${data?.filteredSummary.count ?? 0})`,
            icon: Wallet,
          },
          {
            id: 'tracker',
            label: `Tracker Kas (${rp(monthlyFee)}/bln)`,
            icon: Users,
          },
          {
            id: 'assets',
            label: `Inventaris Aset (${data?.summary.assetCount ?? 0})`,
            icon: Box,
          },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as typeof tab)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition ${
                active
                  ? 'bg-brand-gradient font-semibold text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {item.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ANALITIK & CHART */}
      {tab === 'analytics' && data && (
        <FinanceAnalyticsCharts
          analytics={data.analytics}
          monthlyFee={data.kasTracker.monthlyFee}
        />
      )}

      {/* TAB 2: KAS & TRANSAKSI (WITH FULL PEMASUKAN / PENGELUARAN FILTERS) */}
      {tab === 'cash' && (
        <div className="space-y-5">
          {canManage && (
            <Card>
              <CardHeader className="border-b border-white/60 pb-3.5">
                <CardTitle className="text-base">Catat Transaksi Kas Baru</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={(e) => void addTx(e)} className="grid gap-3 md:grid-cols-6">
                  <FieldGroup label="Jenis Transaksi">
                    <GlassSelect
                      value={txForm.type}
                      onChange={(v) => setTxForm({ ...txForm, type: v as 'INCOME' | 'EXPENSE' })}
                      options={[
                        { value: 'INCOME', label: 'Pemasukan' },
                        { value: 'EXPENSE', label: 'Pengeluaran' },
                      ]}
                    />
                  </FieldGroup>
                  <FieldGroup label="Tanggal" required>
                    <input
                      type="date"
                      required
                      value={txForm.transactionDate}
                      onChange={(e) => setTxForm({ ...txForm, transactionDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm"
                    />
                  </FieldGroup>
                  <FieldGroup label="Kategori" required>
                    <input
                      required
                      list="finance-category-suggestions"
                      placeholder="Operasional / Kas Bulanan"
                      value={txForm.category}
                      onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}
                      className="w-full px-3 py-2 text-sm"
                    />
                    <datalist id="finance-category-suggestions">
                      <option value="Kas Bulanan" />
                      <option value="Operasional" />
                      <option value="Konsumsi" />
                      <option value="Perlengkapan Lab" />
                      <option value="Event" />
                      <option value="Sponsorship" />
                      <option value="Workshop & Pelatihan" />
                      <option value="Competition" />
                    </datalist>
                  </FieldGroup>
                  <FieldGroup label="Keterangan" required>
                    <input
                      required
                      placeholder="Deskripsi transaksi..."
                      value={txForm.description}
                      onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                      className="w-full px-3 py-2 text-sm"
                    />
                  </FieldGroup>
                  <FieldGroup label="Nominal (Rp)" required>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="150000"
                      value={txForm.amount}
                      onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                      className="w-full px-3 py-2 text-sm"
                    />
                  </FieldGroup>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="btn-brand inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5" /> Catat Kas
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-col gap-3 border-b border-white/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Buku Kas & Riwayat Transaksi</CardTitle>
                {/* Segmented Filter Pemasukan / Pengeluaran */}
                <div className="glass-tile inline-flex rounded-xl p-1 text-xs font-medium">
                  {[
                    { id: 'ALL', label: 'Semua', dot: 'bg-violet-500' },
                    { id: 'INCOME', label: 'Pemasukan', dot: 'bg-emerald-500' },
                    { id: 'EXPENSE', label: 'Pengeluaran', dot: 'bg-rose-500' },
                  ].map((opt) => {
                    const active = txTypeFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTxTypeFilter(opt.id as 'ALL' | 'INCOME' | 'EXPENSE')}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                          active
                            ? opt.id === 'INCOME'
                              ? 'bg-emerald-600 font-semibold text-white shadow-sm'
                              : opt.id === 'EXPENSE'
                                ? 'bg-rose-600 font-semibold text-white shadow-sm'
                                : 'bg-brand-gradient font-semibold text-white shadow-sm'
                            : 'text-slate-600 hover:bg-white/75 hover:text-slate-900'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${active ? 'bg-white' : opt.dot}`} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {hasActiveTxFilter && (
                  <button
                    type="button"
                    onClick={resetTxFilters}
                    className="glass-tile inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white/95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset Filter
                  </button>
                )}
                <a
                  href={txExcelUrl}
                  className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-white/95"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Export Transaksi (.xlsx)
                </a>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {/* Advanced Filter Controls */}
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Cari keterangan, kategori..."
                    className="w-full py-2 pl-9 pr-3 text-xs"
                  />
                </div>
                <GlassSelect
                  value={txCategoryFilter}
                  onChange={setTxCategoryFilter}
                  options={[
                    { value: 'ALL', label: 'Semua Kategori' },
                    ...(data?.meta.categories ?? []).map((c) => ({ value: c, label: c })),
                  ]}
                />
                <GlassSelect
                  value={txMonthFilter}
                  onChange={setTxMonthFilter}
                  options={[
                    { value: 'ALL', label: 'Semua Bulan' },
                    ...MONTH_LONG.map((m, idx) => ({ value: String(idx + 1), label: m })),
                  ]}
                />
                <GlassSelect
                  value={txYearFilter}
                  onChange={setTxYearFilter}
                  options={[{ value: 'ALL', label: 'Semua Tahun' }, ...yearOptions]}
                />
                <GlassSelect
                  value={txSourceFilter}
                  onChange={setTxSourceFilter}
                  options={[
                    { value: 'ALL', label: 'Semua Modul' },
                    ...(data?.meta.sourceModules ?? []).map((s) => ({
                      value: s,
                      label: s === 'kas' ? 'Tracker Kas' : s.toUpperCase(),
                    })),
                  ]}
                />
              </div>

              {/* Filtered Subtotal Summary Bar */}
              {data && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/75 bg-white/65 px-4 py-2.5 text-xs backdrop-blur-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                    <Filter className="h-3.5 w-3.5 text-violet-600" />
                    Menampilkan{' '}
                    <strong className="text-slate-900">{data.filteredSummary.count}</strong>{' '}
                    transaksi
                    {txTypeFilter !== 'ALL' && (
                      <Badge variant={txTypeFilter === 'INCOME' ? 'success' : 'secondary'}>
                        {txTypeFilter === 'INCOME' ? 'Khusus Pemasukan' : 'Khusus Pengeluaran'}
                      </Badge>
                    )}
                  </span>
                  <div className="flex flex-wrap items-center gap-4 font-semibold">
                    <span className="text-emerald-700">
                      Masuk: +{rp(data.filteredSummary.totalIncome)}
                    </span>
                    <span className="text-rose-700">
                      Keluar: -{rp(data.filteredSummary.totalExpense)}
                    </span>
                    <span className="text-slate-900">
                      Selisih: {data.filteredSummary.balance >= 0 ? '+' : ''}
                      {rp(data.filteredSummary.balance)}
                    </span>
                  </div>
                </div>
              )}

              {/* Transactions List */}
              {loading && !data ? (
                <p className="py-8 text-center text-xs text-slate-500">Memuat data transaksi...</p>
              ) : (data?.transactions.length ?? 0) === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300/80 bg-white/40 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    Tidak ada transaksi yang cocok dengan filter.
                  </p>
                  {hasActiveTxFilter && (
                    <button
                      type="button"
                      onClick={resetTxFilters}
                      className="mt-2 text-xs font-semibold text-violet-700 hover:underline"
                    >
                      Tampilkan semua transaksi
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-white/60 text-sm">
                  {data?.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                              tx.type === 'INCOME'
                                ? 'bg-emerald-100/90 text-emerald-700'
                                : 'bg-rose-100/90 text-rose-700'
                            }`}
                          >
                            {tx.type === 'INCOME' ? (
                              <ArrowDownLeft className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <span className="font-medium text-slate-900">{tx.description}</span>
                          <Badge variant={tx.type === 'INCOME' ? 'success' : 'secondary'}>
                            {tx.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
                          </Badge>
                          <Badge variant="purple">{tx.sourceModule || 'core'}</Badge>
                        </div>
                        <p className="mt-0.5 pl-8 text-xs text-slate-500">
                          {tx.transactionDate.slice(0, 10)} · Kategori: {tx.category}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-semibold ${
                            tx.type === 'INCOME' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {tx.type === 'INCOME' ? '+' : '-'} {rp(tx.amount)}
                        </span>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTxTarget({
                                id: tx.id,
                                description: tx.description,
                                amount: tx.amount,
                              })
                            }
                            title="Hapus transaksi"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: TRACKER KAS BULANAN ANGGOTA (Rp 15.000 / BULAN) */}
      {tab === 'tracker' && data && (
        <div className="space-y-5">
          {/* Kas Info & Annual Progress Banner */}
          <Card className="aurora-card-blend">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                    {rp(monthlyFee)} / bulan / anggota
                  </span>
                  <span className="text-xs font-semibold text-violet-800">
                    Periode Tahun {analyticsYear}
                  </span>
                </div>
                <h2 className="mt-1.5 text-lg font-bold text-slate-900">
                  Tracker Pembayaran Kas Bulanan Anggota
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Setiap pembayaran yang dicentang otomatis tercatat sebagai Pemasukan kategori{' '}
                  <strong>Kas Bulanan</strong> di Buku Kas dan langsung memperbarui grafik analitik.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="rounded-2xl border border-white/75 bg-white/75 px-4 py-2.5 text-right backdrop-blur-sm">
                  <p className="text-[11px] font-medium text-slate-500">
                    Terkumpul Tahun {analyticsYear}
                  </p>
                  <p className="text-base font-bold text-emerald-700">
                    {rp(data.kasTracker.summary.annualCollected)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {data.kasTracker.summary.annualPaidSlots} /{' '}
                    {data.kasTracker.summary.annualTotalSlots} slot bulan lunas
                  </p>
                </div>
                <a
                  href={kasExcelUrl}
                  className="btn-brand inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Export Tracker Kas (.xlsx)
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 border-b border-white/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="glass-tile inline-flex rounded-xl p-1 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setKasViewMode('matrix')}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      kasViewMode === 'matrix'
                        ? 'bg-brand-gradient font-semibold text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white/70'
                    }`}
                  >
                    Matriks 12 Bulan
                  </button>
                  <button
                    type="button"
                    onClick={() => setKasViewMode('monthly')}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      kasViewMode === 'monthly'
                        ? 'bg-brand-gradient font-semibold text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white/70'
                    }`}
                  >
                    Fokus Per Bulan
                  </button>
                </div>

                {kasViewMode === 'monthly' && (
                  <div className="w-40">
                    <GlassSelect
                      value={String(kasSelectedMonth)}
                      onChange={(v) => setKasSelectedMonth(Number(v))}
                      options={MONTH_LONG.map((m, idx) => ({
                        value: String(idx + 1),
                        label: `${m} ${analyticsYear}`,
                      }))}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={kasSearch}
                    onChange={(e) => setKasSearch(e.target.value)}
                    placeholder="Cari nama / NIM..."
                    className="w-full py-1.5 pl-8 pr-3 text-xs"
                  />
                </div>
                <div className="w-40">
                  <GlassSelect
                    value={kasDivFilter}
                    onChange={setKasDivFilter}
                    options={[
                      { value: 'ALL', label: 'Semua Divisi' },
                      ...kasDivisions.map((d) => ({ value: d, label: d })),
                    ]}
                  />
                </div>
                {kasGenerations.length > 0 && (
                  <div className="w-32">
                    <GlassSelect
                      value={kasGenFilter}
                      onChange={setKasGenFilter}
                      options={[
                        { value: 'ALL', label: 'Semua Gen' },
                        ...kasGenerations.map((g) => ({ value: g, label: `Gen ${g}` })),
                      ]}
                    />
                  </div>
                )}
                {kasViewMode === 'monthly' && (
                  <div className="w-36">
                    <GlassSelect
                      value={kasStatusFilter}
                      onChange={(v) => setKasStatusFilter(v as 'ALL' | 'PAID' | 'UNPAID')}
                      options={[
                        { value: 'ALL', label: 'Semua Status' },
                        { value: 'PAID', label: 'Sudah Lunas' },
                        { value: 'UNPAID', label: 'Belum Bayar' },
                      ]}
                    />
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {/* MODE A: 12-MONTH MATRIX */}
              {kasViewMode === 'matrix' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      Menampilkan <strong>{filteredKasMembers.length}</strong> anggota aktif.{' '}
                      {canManage
                        ? 'Klik kotak bulan untuk menandai Lunas / membatalkan pembayaran (Rp 15.000).'
                        : 'Mode baca saja.'}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-emerald-700">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-md bg-emerald-500 text-white">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                        Lunas ({rp(monthlyFee)})
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-500">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-md border border-slate-300 bg-white/70" />
                        Belum Bayar
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/75 bg-white/55">
                    <table className="w-full min-w-[920px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/80 bg-white/75 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          <th className="sticky left-0 z-10 bg-white/95 px-3.5 py-3 backdrop-blur-sm">
                            Anggota
                          </th>
                          {MONTH_SHORT.map((m, idx) => (
                            <th key={m} className="px-1.5 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setKasSelectedMonth(idx + 1);
                                  setKasViewMode('monthly');
                                }}
                                title={`Lihat detail bulan ${MONTH_LONG[idx]}`}
                                className={`rounded-lg px-2 py-0.5 transition hover:bg-violet-100 hover:text-violet-800 ${
                                  idx + 1 === data.kasTracker.currentMonth
                                    ? 'bg-violet-100/90 text-violet-800'
                                    : ''
                                }`}
                              >
                                {m}
                              </button>
                            </th>
                          ))}
                          <th className="px-3 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/70">
                        {filteredKasMembers.map((member) => (
                          <tr key={member.id} className="hover:bg-white/60">
                            <td className="sticky left-0 z-10 bg-white/90 px-3.5 py-2.5 backdrop-blur-sm">
                              <p className="font-semibold text-slate-900">{member.fullName}</p>
                              <p className="text-[11px] text-slate-500">
                                {member.nim} · {member.divisionName}
                                {member.generation ? ` · ${member.generation}` : ''}
                              </p>
                            </td>
                            {MONTH_SHORT.map((_, idx) => {
                              const monthNum = idx + 1;
                              const pay = member.payments[monthNum];
                              const cellKey = `${member.id}:${monthNum}`;
                              const isBusy = busyKasKey === cellKey;
                              return (
                                <td key={monthNum} className="px-1 py-2 text-center">
                                  <button
                                    type="button"
                                    disabled={!canManage || isBusy}
                                    onClick={() => void handleToggleKas(member, monthNum)}
                                    title={
                                      pay
                                        ? `Lunas ${MONTH_LONG[idx]} (${rp(pay.amount)}) · Tgl ${pay.paidAt.slice(0, 10)}${canManage ? ' — klik untuk batalkan' : ''}`
                                        : `Belum bayar ${MONTH_LONG[idx]} (${rp(monthlyFee)})${canManage ? ' — klik untuk tandai Lunas' : ''}`
                                    }
                                    className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                                      pay
                                        ? 'border-emerald-400/70 bg-emerald-500 text-white shadow-sm hover:bg-emerald-600'
                                        : 'border-slate-200/90 bg-white/75 text-slate-300 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-500'
                                    } ${isBusy ? 'animate-pulse opacity-60' : ''} ${
                                      !canManage ? 'cursor-default' : 'cursor-pointer'
                                    }`}
                                  >
                                    {pay ? (
                                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                    ) : (
                                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="px-3 py-2.5 text-right">
                              <p className="font-semibold text-emerald-700">
                                {rp(member.totalPaid)}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {member.paidMonths}/12 bln
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200/80 bg-white/80 font-semibold text-slate-800">
                          <td className="sticky left-0 z-10 bg-white/95 px-3.5 py-2.5 text-xs">
                            Ringkasan Bulanan ({filteredKasMembers.length} anggota)
                          </td>
                          {MONTH_SHORT.map((_, idx) => {
                            const monthNum = idx + 1;
                            const paidCount = filteredKasMembers.filter((m) =>
                              Boolean(m.payments[monthNum]),
                            ).length;
                            return (
                              <td key={monthNum} className="px-1 py-2.5 text-center">
                                <span
                                  className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                    paidCount === filteredKasMembers.length && paidCount > 0
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : paidCount > 0
                                        ? 'bg-violet-100 text-violet-700'
                                        : 'text-slate-400'
                                  }`}
                                >
                                  {paidCount}/{filteredKasMembers.length}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2.5 text-right text-emerald-700">
                            {rp(filteredKasMembers.reduce((a, m) => a + m.totalPaid, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* MODE B: FOCUSED MONTHLY CHECKLIST */}
              {kasViewMode === 'monthly' && (
                <div className="space-y-4">
                  {/* Month Progress Summary Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/75 bg-white/70 p-4 backdrop-blur-sm">
                    <div className="min-w-[220px] flex-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-800">
                          Kas {MONTH_LONG[kasSelectedMonth - 1]} {analyticsYear} ·{' '}
                          <span className="text-emerald-700">{selectedMonthStats.paid} Lunas</span>{' '}
                          / <span className="text-rose-700">{selectedMonthStats.unpaid} Belum</span>
                        </span>
                        <span className="text-violet-700">{selectedMonthStats.pct}%</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
                        <div
                          className="bg-brand-gradient h-full rounded-full transition-all"
                          style={{ width: `${selectedMonthStats.pct}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-4 text-[11px] text-slate-600">
                        <span>
                          Terkumpul:{' '}
                          <strong className="text-emerald-700">
                            {rp(selectedMonthStats.collected)}
                          </strong>
                        </span>
                        <span>
                          Target: <strong>{rp(selectedMonthStats.target)}</strong>
                        </span>
                        <span>
                          Tunggakan:{' '}
                          <strong className="text-rose-700">
                            {rp(selectedMonthStats.remaining)}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {canManage && unpaidInSelectedMonth.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setConfirmBulkPay(true)}
                        className="btn-brand inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold"
                      >
                        <CheckCheck className="h-3.5 w-3.5" /> Tandai Semua Lunas (
                        {unpaidInSelectedMonth.length})
                      </button>
                    )}
                  </div>

                  {/* Member rows for selected month */}
                  <div className="divide-y divide-white/60 text-sm">
                    {filteredKasMembers.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-500">
                        Tidak ada anggota sesuai filter.
                      </p>
                    ) : (
                      filteredKasMembers.map((member) => {
                        const pay = member.payments[kasSelectedMonth];
                        const isBusy = busyKasKey === `${member.id}:${kasSelectedMonth}`;
                        return (
                          <div
                            key={member.id}
                            className="flex flex-wrap items-center justify-between gap-3 py-3"
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-900">
                                  {member.fullName}
                                </span>
                                <span className="font-mono text-xs text-slate-500">
                                  {member.nim}
                                </span>
                                {member.generation && (
                                  <Badge variant="purple">{member.generation}</Badge>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {member.divisionName} · {member.positionTitle}
                                {pay ? ` · Dibayar ${pay.paidAt.slice(0, 10)}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant={pay ? 'success' : 'secondary'}>
                                {pay
                                  ? `● Lunas (${rp(pay.amount)})`
                                  : `● Belum (${rp(monthlyFee)})`}
                              </Badge>
                              {canManage && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleToggleKas(member, kasSelectedMonth)}
                                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                    pay
                                      ? 'glass-tile text-rose-700 hover:bg-rose-50'
                                      : 'btn-brand text-white'
                                  }`}
                                >
                                  {isBusy ? 'Menyimpan...' : pay ? 'Batalkan' : 'Tandai Lunas'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: INVENTARIS ASET */}
      {tab === 'assets' && (
        <Card>
          <CardHeader>
            <CardTitle>Inventaris Aset Laboratorium</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {canManage && (
              <form onSubmit={(e) => void addAsset(e)} className="grid gap-3 md:grid-cols-6">
                <FieldGroup label="Kode Aset" required>
                  <input
                    required
                    placeholder="EISD-AST-002"
                    value={assetForm.code}
                    onChange={(e) => setAssetForm({ ...assetForm, code: e.target.value })}
                    className="w-full px-3 py-2 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Nama Aset" required className="md:col-span-2">
                  <input
                    required
                    placeholder="Monitor / Proyektor"
                    value={assetForm.name}
                    onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Kategori" required>
                  <input
                    required
                    placeholder="Elektronik"
                    value={assetForm.category}
                    onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Jumlah">
                  <input
                    type="number"
                    min={1}
                    value={assetForm.quantity}
                    onChange={(e) => setAssetForm({ ...assetForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 text-sm"
                  />
                </FieldGroup>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="btn-brand inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tambah
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-white/60 text-sm">
              {data?.assets.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {a.name} <span className="font-mono text-xs text-slate-500">({a.code})</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {a.category} · {a.location || '-'} · Jumlah: {a.quantity}
                    </p>
                  </div>
                  <Badge variant={a.condition === 'GOOD' ? 'success' : 'secondary'}>
                    ● {a.condition}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Centered Glass Confirm Dialog: Delete Transaction */}
      <GlassConfirmDialog
        open={Boolean(deleteTxTarget)}
        title="Hapus Transaksi Kas?"
        description={
          deleteTxTarget
            ? `Transaksi "${deleteTxTarget.description}" senilai ${rp(deleteTxTarget.amount)} akan dihapus dari buku kas. Jika transaksi ini berasal dari Tracker Kas Bulanan, status lunas anggota terkait juga akan dibatalkan.`
            : ''
        }
        confirmLabel="Ya, Hapus Transaksi"
        cancelLabel="Batal"
        variant="danger"
        loading={deletingTx}
        onCancel={() => setDeleteTxTarget(null)}
        onConfirm={() => void confirmDeleteTx()}
      />

      {/* Centered Glass Confirm Dialog: Bulk Mark Kas Paid */}
      <GlassConfirmDialog
        open={confirmBulkPay}
        title={`Tandai Lunas Kas ${MONTH_LONG[kasSelectedMonth - 1]} ${analyticsYear}?`}
        description={`Sebanyak ${unpaidInSelectedMonth.length} anggota yang belum membayar akan ditandai LUNAS masing-masing ${rp(monthlyFee)} (total +${rp(unpaidInSelectedMonth.length * monthlyFee)} masuk ke buku kas).`}
        confirmLabel="Ya, Tandai Semua Lunas"
        cancelLabel="Batal"
        variant="primary"
        loading={bulkPaying}
        onCancel={() => setConfirmBulkPay(false)}
        onConfirm={() => void handleBulkPayMonth()}
      />
    </div>
  );
}
