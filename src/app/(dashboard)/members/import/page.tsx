'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { apiFetch } from '@/components/client-api';
import { FieldGroup, GlassFileDropzone, GlassSelect } from '@/components/glass-inputs';
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
    if (!file) {
      setErr('Silakan pilih file Excel (.xlsx) atau CSV (.csv) terlebih dahulu.');
      return;
    }
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
      setFile(null);
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Import Excel / CSV Anggota
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Dry-run validasi, laporan error per baris, dan rollback aman per batch.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/members/export?template=true&format=xlsx"
            className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-violet-800 transition hover:bg-white/95"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" /> Template XLSX
          </a>
          <a
            href="/api/members/export?template=true&format=csv"
            className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/95"
          >
            <Download className="h-3.5 w-3.5 text-violet-600" /> Template CSV
          </a>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-2.5 text-sm text-rose-700 backdrop-blur-sm">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-2.5 text-sm text-emerald-800 backdrop-blur-sm">
          {msg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Upload & Dry-Run</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handlePreview(e)} className="grid gap-4 md:grid-cols-12">
            <FieldGroup label="File Data Anggota (.xlsx / .csv)" required className="md:col-span-6">
              <GlassFileDropzone
                file={file}
                onFileSelect={setFile}
                accept=".xlsx,.csv"
                hint="Seret file Excel/CSV ke sini atau klik untuk memilih"
              />
            </FieldGroup>
            <FieldGroup label="Strategi Jika NIM Duplikat" className="md:col-span-3">
              <GlassSelect
                value={strategy}
                onChange={(v) => setStrategy(v as 'SKIP' | 'OVERWRITE' | 'MERGE')}
                options={[
                  { value: 'SKIP', label: 'SKIP duplikat', hint: 'Lewati data yang sudah ada' },
                  {
                    value: 'OVERWRITE',
                    label: 'OVERWRITE duplikat',
                    hint: 'Timpa seluruh kolom lama',
                  },
                  {
                    value: 'MERGE',
                    label: 'MERGE duplikat',
                    hint: 'Isi hanya kolom yang kosong',
                  },
                ]}
              />
            </FieldGroup>
            <div className="flex items-end md:col-span-3">
              <button
                type="submit"
                disabled={!file}
                className="btn-brand inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="h-4 w-4" /> Preview & Validasi
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>2. Hasil Dry-Run ({preview.fileName})</CardTitle>
              <div className="flex gap-2">
                <Badge variant="success">● Valid: {preview.validCount}</Badge>
                <Badge variant="secondary">Skip: {preview.skippedCount}</Badge>
                <Badge variant={preview.failedCount > 0 ? 'danger' : 'secondary'}>
                  Error: {preview.failedCount}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {preview.columns.map((c) => (
                <FieldGroup key={c.key} label={c.label} required={c.required}>
                  <GlassSelect
                    value={mapping[c.key] ?? ''}
                    onChange={(v) => setMapping({ ...mapping, [c.key]: v })}
                    placeholder="-- Abaikan --"
                    options={[
                      { value: '', label: '-- Abaikan --' },
                      ...preview.headers.map((h) => ({ value: h, label: h })),
                    ]}
                  />
                </FieldGroup>
              ))}
            </div>
            {preview.errors.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-2xl border border-rose-200/80 bg-rose-50/80 p-3 text-xs text-rose-800">
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
              className="btn-brand rounded-xl px-5 py-2.5 text-sm font-semibold"
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
        <CardContent className="divide-y divide-white/60 text-sm">
          {batches.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="flex items-center gap-2 font-medium text-slate-900">
                  <span>{b.fileName}</span>
                  <Badge variant={b.status === 'COMPLETED' ? 'success' : 'purple'}>
                    {b.status}
                  </Badge>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Total {b.totalRows} · Sukses {b.successCount} · Skip {b.skippedCount} · Gagal{' '}
                  {b.failedCount}
                </p>
              </div>
              {b.status === 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => void handleRollback(b.id)}
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200/80 bg-rose-50/70 px-3 py-1.5 text-xs font-semibold text-rose-700 backdrop-blur-sm transition hover:bg-rose-100"
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
