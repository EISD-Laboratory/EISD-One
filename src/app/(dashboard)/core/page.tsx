'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { GlassSelect } from '@/components/glass-inputs';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface CoreOverview {
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    assetCount: number;
    recordCount: number;
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
  records: Array<{
    id: string;
    recordType: string;
    referenceNo: string | null;
    title: string;
    recordDate: string;
    summary: string | null;
  }>;
}

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export default function CoreModulePage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<CoreOverview | null>(null);
  const [tab, setTab] = useState<'cash' | 'assets' | 'records'>('cash');
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
    location: 'Ruang Lab',
    quantity: '1',
  });
  const [recForm, setRecForm] = useState({
    recordType: 'MEETING',
    referenceNo: '',
    title: '',
    recordDate: new Date().toISOString().slice(0, 10),
    summary: '',
  });

  const load = useCallback(async () => {
    setData(await apiFetch<CoreOverview>('/api/modules/core'));
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  async function addTx(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/modules/core', {
      method: 'POST',
      body: JSON.stringify({ kind: 'transaction', ...txForm }),
    });
    setTxForm({ ...txForm, description: '', amount: '' });
    await load();
  }

  async function addAsset(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/modules/core', {
      method: 'POST',
      body: JSON.stringify({ kind: 'asset', ...assetForm }),
    });
    setAssetForm({ ...assetForm, code: '', name: '' });
    await load();
  }

  async function addRecord(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/modules/core', {
      method: 'POST',
      body: JSON.stringify({ kind: 'record', ...recForm }),
    });
    setRecForm({ ...recForm, referenceNo: '', title: '', summary: '' });
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Modul Core — Kas, Aset & Administrasi
          </h1>
          <p className="text-sm text-slate-500">
            Kas menerima catatan otomatis dari realisasi Event & apresiasi Enabler.
          </p>
        </div>
        <a
          href="/api/modules/core?export=xlsx"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
        >
          <Download className="h-3.5 w-3.5" /> Export Kas XLSX
        </a>
      </div>

      {data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs text-slate-500">Total Pemasukan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-emerald-700">{rp(data.summary.totalIncome)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-xs text-slate-500">Total Pengeluaran</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-rose-700">{rp(data.summary.totalExpense)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-xs text-slate-500">Saldo Kas Bersih</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-slate-900">{rp(data.summary.balance)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex gap-2">
        {(['cash', 'assets', 'records'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tab === t ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
          >
            {t === 'cash'
              ? 'Kas & Transaksi'
              : t === 'assets'
                ? 'Inventaris Aset'
                : 'Rapat & Surat'}
          </button>
        ))}
      </div>

      {tab === 'cash' && (
        <Card>
          <CardHeader>
            <CardTitle>Transaksi Kas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasPermission('core.finance.manage') && (
              <form onSubmit={(e) => void addTx(e)} className="grid gap-2 md:grid-cols-5">
                <GlassSelect
                  value={txForm.type}
                  onChange={(v) => setTxForm({ ...txForm, type: v })}
                  options={[
                    { value: 'INCOME', label: 'Pemasukan' },
                    { value: 'EXPENSE', label: 'Pengeluaran' },
                  ]}
                />
                <input
                  required
                  placeholder="Kategori"
                  value={txForm.category}
                  onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  required
                  placeholder="Keterangan"
                  value={txForm.description}
                  onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="Nominal (Rp)"
                  value={txForm.amount}
                  onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="rounded bg-slate-900 py-1.5 text-xs font-medium text-white"
                >
                  Catat Transaksi
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-100 text-sm">
              {data?.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {tx.description}{' '}
                      <Badge variant="secondary">{tx.sourceModule || 'core'}</Badge>
                    </p>
                    <p className="text-xs text-slate-500">
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
          <CardContent className="space-y-4">
            {hasPermission('core.finance.manage') && (
              <form onSubmit={(e) => void addAsset(e)} className="grid gap-2 md:grid-cols-5">
                <input
                  required
                  placeholder="Kode (EISD-AST-002)"
                  value={assetForm.code}
                  onChange={(e) => setAssetForm({ ...assetForm, code: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  required
                  placeholder="Nama Aset"
                  value={assetForm.name}
                  onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  required
                  placeholder="Kategori"
                  value={assetForm.category}
                  onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={assetForm.quantity}
                  onChange={(e) => setAssetForm({ ...assetForm, quantity: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="rounded bg-slate-900 py-1.5 text-xs font-medium text-white"
                >
                  Tambah Aset
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-100 text-sm">
              {data?.assets.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">
                      {a.name} <span className="font-mono text-xs text-slate-500">({a.code})</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {a.category} · {a.location || '-'} · Jumlah: {a.quantity}
                    </p>
                  </div>
                  <Badge variant={a.condition === 'GOOD' ? 'success' : 'secondary'}>
                    {a.condition}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'records' && (
        <Card>
          <CardHeader>
            <CardTitle>Notulen Rapat & Surat Menyurat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasPermission('core.record.manage') && (
              <form onSubmit={(e) => void addRecord(e)} className="grid gap-2 md:grid-cols-4">
                <GlassSelect
                  value={recForm.recordType}
                  onChange={(v) => setRecForm({ ...recForm, recordType: v })}
                  options={[
                    { value: 'MEETING', label: 'Rapat / Notulen' },
                    { value: 'LETTER', label: 'Surat Resmi' },
                  ]}
                />
                <input
                  placeholder="No. Surat (opsional)"
                  value={recForm.referenceNo}
                  onChange={(e) => setRecForm({ ...recForm, referenceNo: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  required
                  placeholder="Judul Rapat / Perihal Surat"
                  value={recForm.title}
                  onChange={(e) => setRecForm({ ...recForm, title: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="rounded bg-slate-900 py-1.5 text-xs font-medium text-white"
                >
                  Simpan Catatan
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-100 text-sm">
              {data?.records.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-slate-500">
                      {r.recordDate.slice(0, 10)} {r.referenceNo ? `· No: ${r.referenceNo}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary">{r.recordType}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
