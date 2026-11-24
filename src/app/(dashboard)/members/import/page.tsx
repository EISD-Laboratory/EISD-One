'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface PreviewRes {
  batchId: string;
  fileName: string;
  headers: string[];
  columns: Array<{ key: string; label: string; required?: boolean }>;
  columnMapping: Record<string, string>;
  totalRows: number;
  validCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ rowNumber: number; errors: string[] }>;
}

interface BatchItem {
  id: string;
  fileName: string;
  duplicateStrategy: string;
  status: string;
  totalRows: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
}

export default function MembersImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [strategy, setStrategy] = useState<'SKIP' | 'OVERWRITE' | 'MERGE'>('SKIP');
  const [preview, setPreview] = useState<PreviewRes | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    const res = await apiFetch<{ items: BatchItem[] }>('/api/members/import');
    setBatches(res.items);
  }, []);

  useEffect(() => {
    void loadBatches().catch(() => undefined);
  }, [loadBatches]);

  async function handlePreview(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setErr(null);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('duplicateStrategy', strategy);
      const res = await apiFetch<PreviewRes>('/api/members/import', { method: 'POST', body: fd });
      setPreview(res);
      setMapping(res.columnMapping);
      await loadBatches();
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : 'Gagal validasi file.');
    }
  }

  async function handleCommit() {
    if (!preview) return;
    setErr(null);
    try {
      const res = await apiFetch<BatchItem>('/api/members/import', {
        method: 'POST',
        body: JSON.stringify({
          action: 'commit',
          batchId: preview.batchId,
          duplicateStrategy: strategy,
          columnMapping: mapping,
        }),
      });
      setMsg(
        `Import selesai: ${res.successCount} berhasil, ${res.skippedCount} dilewati, ${res.failedCount} gagal.`,
      );
      setPreview(null);
      await loadBatches();
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : 'Gagal memproses import.');
    }
  }

  async function handleRollback(batchId: string) {
    if (!confirm('Rollback batch ini? Data baru akan di-soft-delete dan data lama dipulihkan.'))
      return;
    const res = await apiFetch<{ rolledBackCount: number }>('/api/members/import', {
      method: 'POST',
      body: JSON.stringify({ action: 'rollback', batchId }),
    });
    setMsg(`Rollback selesai (${res.rolledBackCount} baris dipulihkan).`);
    await loadBatches();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Excel / CSV Anggota</h1>
          <p className="text-sm text-slate-500">
            Dry-run validasi, laporan error per baris, dan rollback per batch.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/members/export?template=true&format=xlsx"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" /> Template XLSX
          </a>
          <a
            href="/api/members/export?template=true&format=csv"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" /> Template CSV
          </a>
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Upload & Dry-Run</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handlePreview(e)} className="flex flex-wrap items-end gap-3">
            <input
              type="file"
              accept=".xlsx,.csv"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            />
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as 'SKIP' | 'OVERWRITE' | 'MERGE')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="SKIP">SKIP duplikat</option>
              <option value="OVERWRITE">OVERWRITE duplikat</option>
              <option value="MERGE">MERGE duplikat</option>
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              <Upload className="h-4 w-4" /> Preview & Validasi
            </button>
          </form>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>2. Hasil Dry-Run ({preview.fileName})</CardTitle>
              <div className="flex gap-2">
                <Badge variant="success">Valid: {preview.validCount}</Badge>
                <Badge variant="secondary">Skip: {preview.skippedCount}</Badge>
                <Badge variant={preview.failedCount > 0 ? 'danger' : 'secondary'}>
                  Error: {preview.failedCount}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {preview.columns.map((c) => (
                <div key={c.key}>
                  <label className="block text-xs text-slate-600">
                    {c.label}
                    {c.required ? ' *' : ''}
                  </label>
                  <select
                    value={mapping[c.key] ?? ''}
                    onChange={(e) => setMapping({ ...mapping, [c.key]: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="">-- Abaikan --</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {preview.errors.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {preview.errors.map((e) => (
                  <p key={e.rowNumber}>
                    Baris {e.rowNumber}: {e.errors.join('; ')}
                  </p>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleCommit()}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
            >
              Konfirmasi & Simpan ke Database
            </button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Batch & Rollback</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {batches.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <p className="font-medium text-slate-900">
                  {b.fileName} <Badge variant="secondary">{b.status}</Badge>
                </p>
                <p className="text-xs text-slate-500">
                  Total {b.totalRows} · Sukses {b.successCount} · Skip {b.skippedCount} · Gagal{' '}
                  {b.failedCount}
                </p>
              </div>
              {b.status === 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => void handleRollback(b.id)}
                  className="inline-flex items-center gap-1 rounded border border-rose-300 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50"
                >
                  <RotateCcw className="h-3 w-3" /> Rollback
                </button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
