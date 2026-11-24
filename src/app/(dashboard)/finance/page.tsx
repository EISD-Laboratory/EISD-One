'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Box, Download, Plus, Wallet } from 'lucide-react';
import { useBreadcrumb } from '@/components/app-shell';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { FieldGroup, GlassSelect } from '@/components/glass-inputs';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface CoreFinanceData {
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    assetCount: number;
  };
  transactions: Array<{
    id: string;
    type: string;
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

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export default function FinancePage() {
  const { hasPermission } = useAuth();
  const { setExtraCrumbs } = useBreadcrumb();
  const canManage = hasPermission('core.finance.manage');

  const [data, setData] = useState<CoreFinanceData | null>(null);
  const [tab, setTab] = useState<'cash' | 'assets'>('cash');
  const [msg, setMsg] = useState<string | null>(null);
  const [txForm, setTxForm] = useState({
    type: 'EXPENSE',
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

  const load = useCallback(async () => {
    setData(await apiFetch<CoreFinanceData>('/api/modules/core'));
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    setExtraCrumbs([{ label: tab === 'cash' ? 'Kas & Transaksi' : 'Inventaris Aset' }]);
  }, [tab, setExtraCrumbs]);

  async function addTx(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    await apiFetch('/api/modules/core', {
      method: 'POST',
      body: JSON.stringify({ kind: 'transaction', ...txForm }),
    });
    setTxForm({ ...txForm, description: '', amount: '' });
    setMsg('Transaksi kas berhasil dicatat.');
    await load();
  }

  async function addAsset(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    await apiFetch('/api/modules/core', {
      method: 'POST',
      body: JSON.stringify({ kind: 'asset', ...assetForm }),
    });
    setAssetForm({ ...assetForm, code: '', name: '' });
    setMsg('Aset inventaris baru berhasil ditambahkan.');
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Keuangan & Aset EISD</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Pengelolaan kas lab, pemasukan/pengeluaran otomatis lintas modul (Event, Enabler,
            Competition), dan inventaris aset.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/modules/core?export=xlsx"
            className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-violet-800 transition hover:bg-white/95"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" /> Export Kas XLSX
          </a>
          <a
            href="/api/modules/core?export=csv"
            className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/95"
          >
            <Download className="h-3.5 w-3.5 text-violet-600" /> CSV
          </a>
        </div>
      </div>

      {msg && (
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-2.5 text-sm text-emerald-800 backdrop-blur-sm">
          {msg}
        </div>
      )}

      {data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="aurora-card-green">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Total Pemasukan</span>
                <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-emerald-600">
                  <ArrowDownLeft className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-emerald-700">
                {rp(data.summary.totalIncome)}
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
              <p className="mt-3 text-2xl font-bold text-rose-700">
                {rp(data.summary.totalExpense)}
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
              <p className="mt-3 text-2xl font-bold text-slate-900">{rp(data.summary.balance)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="glass-tile inline-flex rounded-xl p-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => setTab('cash')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition ${
            tab === 'cash'
              ? 'bg-brand-gradient font-semibold text-white shadow-sm'
              : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
          }`}
        >
          <Wallet className="h-3.5 w-3.5" /> Kas & Transaksi
        </button>
        <button
          type="button"
          onClick={() => setTab('assets')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition ${
            tab === 'assets'
              ? 'bg-brand-gradient font-semibold text-white shadow-sm'
              : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
          }`}
        >
          <Box className="h-3.5 w-3.5" /> Inventaris Aset ({data?.summary.assetCount ?? 0})
        </button>
      </div>

      {tab === 'cash' && (
        <Card>
          <CardHeader>
            <CardTitle>Buku Kas & Riwayat Transaksi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {canManage && (
              <form onSubmit={(e) => void addTx(e)} className="grid gap-3 md:grid-cols-5">
                <FieldGroup label="Jenis Transaksi">
                  <GlassSelect
                    value={txForm.type}
                    onChange={(v) => setTxForm({ ...txForm, type: v })}
                    options={[
                      { value: 'INCOME', label: 'Pemasukan' },
                      { value: 'EXPENSE', label: 'Pengeluaran' },
                    ]}
                  />
                </FieldGroup>
                <FieldGroup label="Kategori" required>
                  <input
                    required
                    placeholder="Operasional / Iuran"
                    value={txForm.category}
                    onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Keterangan" required>
                  <input
                    required
                    placeholder="Deskripsi transaksi"
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
            )}

            <div className="divide-y divide-white/60 text-sm">
              {data?.transactions.map((tx) => (
                <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                      <span>{tx.description}</span>
                      <Badge variant="purple">{tx.sourceModule || 'core'}</Badge>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {tx.transactionDate.slice(0, 10)} · {tx.category}
                    </p>
                  </div>
                  <span
                    className={`font-semibold ${tx.type === 'INCOME' ? 'text-emerald-700' : 'text-rose-700'}`}
                  >
                    {tx.type === 'INCOME' ? '+' : '-'} {rp(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
