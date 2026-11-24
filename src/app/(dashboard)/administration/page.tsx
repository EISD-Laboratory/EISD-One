'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ExternalLink, FileText, FolderKanban, Mail, Plus } from 'lucide-react';
import { useBreadcrumb } from '@/components/app-shell';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { FieldGroup, GlassSelect } from '@/components/glass-inputs';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface AdminRecord {
  id: string;
  recordType: 'MEETING' | 'LETTER';
  referenceNo: string | null;
  title: string;
  recordDate: string;
  summary: string | null;
  documentUrl: string | null;
}

export default function AdministrationPage() {
  const { hasPermission } = useAuth();
  const { setExtraCrumbs } = useBreadcrumb();
  const canManage = hasPermission('core.record.manage');

  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'MEETING' | 'LETTER'>('ALL');
  const [msg, setMsg] = useState<string | null>(null);
  const [recForm, setRecForm] = useState({
    recordType: 'MEETING' as 'MEETING' | 'LETTER',
    referenceNo: '',
    title: '',
    recordDate: new Date().toISOString().slice(0, 10),
    summary: '',
    documentUrl: '',
  });

  const load = useCallback(async () => {
    const res = await apiFetch<{ records: AdminRecord[] }>('/api/modules/core');
    setRecords(res.records);
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (filter === 'MEETING') setExtraCrumbs([{ label: 'Notulen Rapat' }]);
    else if (filter === 'LETTER') setExtraCrumbs([{ label: 'Surat Resmi' }]);
    else setExtraCrumbs([]);
  }, [filter, setExtraCrumbs]);

  async function addRecord(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    await apiFetch('/api/modules/core', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'record',
        recordType: recForm.recordType,
        referenceNo: recForm.referenceNo || undefined,
        title: recForm.title,
        recordDate: recForm.recordDate,
        summary: recForm.summary || undefined,
        documentUrl: recForm.documentUrl || undefined,
      }),
    });
    setRecForm({
      ...recForm,
      referenceNo: '',
      title: '',
      summary: '',
      documentUrl: '',
    });
    setMsg('Arsip administrasi berhasil disimpan.');
    await load();
  }

  const meetingCount = useMemo(
    () => records.filter((r) => r.recordType === 'MEETING').length,
    [records],
  );
  const letterCount = useMemo(
    () => records.filter((r) => r.recordType === 'LETTER').length,
    [records],
  );
  const visibleRecords = useMemo(
    () => (filter === 'ALL' ? records : records.filter((r) => r.recordType === filter)),
    [records, filter],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Administrasi & Kesekretariatan
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Arsip notulen rapat, penomoran surat masuk/keluar, dan tautan dokumen resmi Laboratorium
          EISD.
        </p>
      </div>

      {msg && (
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-2.5 text-sm text-emerald-800 backdrop-blur-sm">
          {msg}
        </div>
      )}

      {/* 3 Kartu Ringkasan Administrasi */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="aurora-card-blend">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Total Arsip</span>
              <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-violet-600">
                <FolderKanban className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{records.length}</p>
          </CardContent>
        </Card>

        <Card className="aurora-card-green">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Notulen Rapat</span>
              <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-emerald-600">
                <FileText className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-emerald-700">{meetingCount}</p>
          </CardContent>
        </Card>

        <Card className="aurora-card-purple">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Surat Resmi</span>
              <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-violet-600">
                <Mail className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-violet-700">{letterCount}</p>
          </CardContent>
        </Card>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Catat Notulen Rapat atau Surat Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void addRecord(e)} className="grid gap-3 md:grid-cols-3">
              <FieldGroup label="Jenis Dokumen">
                <GlassSelect
                  value={recForm.recordType}
                  onChange={(v) =>
                    setRecForm({ ...recForm, recordType: v as 'MEETING' | 'LETTER' })
                  }
                  options={[
                    {
                      value: 'MEETING',
                      label: 'Notulen Rapat',
                      hint: 'Hasil rapat internal/pengurus',
                    },
                    { value: 'LETTER', label: 'Surat Resmi', hint: 'Surat masuk / surat keluar' },
                  ]}
                />
              </FieldGroup>
              <FieldGroup label="No. Surat / Referensi">
                <input
                  placeholder="Mis. 001/EISD/XI/2026"
                  value={recForm.referenceNo}
                  onChange={(e) => setRecForm({ ...recForm, referenceNo: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm"
                />
              </FieldGroup>
              <FieldGroup label="Tanggal" required>
                <input
                  type="date"
                  required
                  value={recForm.recordDate}
                  onChange={(e) => setRecForm({ ...recForm, recordDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm"
                />
              </FieldGroup>
              <FieldGroup label="Judul Rapat / Perihal Surat" required className="md:col-span-2">
                <input
                  required
                  placeholder="Mis. Rapat Evaluasi Program Kerja Tengah Periode"
                  value={recForm.title}
                  onChange={(e) => setRecForm({ ...recForm, title: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm"
                />
              </FieldGroup>
              <FieldGroup label="Tautan Dokumen (Opsional)">
                <input
                  placeholder="https://drive.google.com/..."
                  value={recForm.documentUrl}
                  onChange={(e) => setRecForm({ ...recForm, documentUrl: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm"
                />
              </FieldGroup>
              <FieldGroup label="Ringkasan / Poin Penting" className="md:col-span-2">
                <input
                  placeholder="Keputusan rapat atau isi ringkas surat..."
                  value={recForm.summary}
                  onChange={(e) => setRecForm({ ...recForm, summary: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm"
                />
              </FieldGroup>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="btn-brand inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" /> Simpan Arsip
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 border-b border-white/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Daftar Arsip ({visibleRecords.length})</CardTitle>
          <div className="glass-tile inline-flex rounded-xl p-1 text-xs font-medium">
            {[
              { id: 'ALL', label: `Semua (${records.length})` },
              { id: 'MEETING', label: `Notulen (${meetingCount})` },
              { id: 'LETTER', label: `Surat (${letterCount})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id as 'ALL' | 'MEETING' | 'LETTER')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  filter === t.id
                    ? 'bg-brand-gradient font-semibold text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-white/60 pt-2 text-sm">
          {visibleRecords.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">
              Belum ada arsip rapat atau surat tercatat.
            </p>
          ) : (
            visibleRecords.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{r.title}</span>
                    <Badge variant={r.recordType === 'MEETING' ? 'success' : 'purple'}>
                      ● {r.recordType === 'MEETING' ? 'Notulen Rapat' : 'Surat Resmi'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.recordDate.slice(0, 10)}
                    {r.referenceNo ? ` · No: ${r.referenceNo}` : ''}
                  </p>
                  {r.summary && <p className="mt-1.5 text-xs text-slate-600">{r.summary}</p>}
                </div>
                {r.documentUrl && (
                  <a
                    href={r.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="glass-tile inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-white/95"
                  >
                    Dokumen <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
