'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Archive,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  FolderKanban,
  Mail,
  Plus,
  Printer,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useBreadcrumb } from '@/components/app-shell';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { FieldGroup, GlassConfirmDialog, GlassSelect } from '@/components/glass-inputs';
import { LetterPaperPreview } from '@/components/letter-preview';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import {
  formatAutoLetterNumber,
  getDefaultLetterPayload,
  getTemplateMeta,
  LETTER_TEMPLATES,
  type LetterPayload,
  type LetterTemplateCode,
} from '@/modules/core/letter-templates';

interface AdminRecord {
  id: string;
  recordType: 'MEETING' | 'LETTER';
  referenceNo: string | null;
  templateCode: string | null;
  sequenceYear: number | null;
  sequenceNo: number | null;
  title: string;
  recordDate: string;
  summary: string | null;
  letterDataJson: LetterPayload | null;
  documentUrl: string | null;
}

interface ActiveMemberLite {
  id: string;
  nim: string;
  fullName: string;
  divisionName: string;
  positionTitle: string;
}

interface AdminApiPayload {
  records: AdminRecord[];
  meta?: {
    nextLetterSeqByYear?: Record<number, number>;
  };
  kasTracker?: {
    members: ActiveMemberLite[];
  };
}

export default function AdministrationPage() {
  const { hasPermission } = useAuth();
  const { setExtraCrumbs } = useBreadcrumb();
  const canManage = hasPermission('core.record.manage');

  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [members, setMembers] = useState<ActiveMemberLite[]>([]);
  const [nextSeqByYear, setNextSeqByYear] = useState<Record<number, number>>({});
  const [tab, setTab] = useState<'builder' | 'archive' | 'manual'>('builder');
  const [archiveFilter, setArchiveFilter] = useState<'ALL' | 'MEETING' | 'LETTER'>('ALL');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Template Letter Builder State
  const [letterForm, setLetterForm] = useState<LetterPayload>(() => getDefaultLetterPayload('UND'));
  const [savingLetter, setSavingLetter] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<{
    id: string;
    referenceNo: string;
    title: string;
  } | null>(null);

  // Modal preview for saved archive letters
  const [previewRecord, setPreviewRecord] = useState<AdminRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
    referenceNo: string | null;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Manual Notulen / Surat Masuk Form
  const [recForm, setRecForm] = useState({
    recordType: 'MEETING' as 'MEETING' | 'LETTER',
    referenceNo: '',
    title: '',
    recordDate: new Date().toISOString().slice(0, 10),
    summary: '',
    documentUrl: '',
  });

  const load = useCallback(async () => {
    const res = await apiFetch<AdminApiPayload>('/api/modules/core');
    setRecords(res.records ?? []);
    setMembers(res.kasTracker?.members ?? []);
    setNextSeqByYear(res.meta?.nextLetterSeqByYear ?? {});
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    const labels: Record<typeof tab, string> = {
      builder: 'Buat & Cetak Surat',
      archive: 'Arsip Surat & Notulen',
      manual: 'Catat Notulen / Surat Masuk',
    };
    setExtraCrumbs([{ label: labels[tab] }]);
  }, [tab, setExtraCrumbs]);

  const activeTemplate = useMemo(
    () => getTemplateMeta(letterForm.templateCode),
    [letterForm.templateCode],
  );

  // Live preview of auto-generated letter number based on selected year & template
  const previewLetterNo = useMemo(() => {
    const yr = Number(letterForm.letterDate.slice(0, 4)) || new Date().getFullYear();
    const nextSeq = nextSeqByYear[yr] ?? 1;
    return formatAutoLetterNumber(nextSeq, letterForm.templateCode, letterForm.letterDate);
  }, [letterForm.letterDate, letterForm.templateCode, nextSeqByYear]);

  function selectTemplate(code: LetterTemplateCode) {
    const meta = getTemplateMeta(code);
    setLetterForm((prev) => ({
      ...prev,
      templateCode: code,
      subject: meta.defaultSubject,
      attachment: meta.defaultAttachment,
    }));
    setLastGenerated(null);
  }

  function autofillFromMember(memberId: string) {
    const found = members.find((m) => m.id === memberId);
    if (!found) return;
    setLetterForm((prev) => ({
      ...prev,
      memberName: found.fullName,
      memberNim: found.nim,
      memberDivision: `${found.divisionName} — ${found.positionTitle}`,
    }));
  }

  async function saveAndExportLetter(mode: 'download' | 'open' | 'save') {
    if (!canManage) return;
    setSavingLetter(true);
    setMsg(null);
    try {
      const created = await apiFetch<AdminRecord>('/api/modules/core', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'generated_letter',
          ...letterForm,
        }),
      });
      const refNo = created.referenceNo || previewLetterNo;
      setLastGenerated({ id: created.id, referenceNo: refNo, title: created.title });
      setMsg({
        kind: 'ok',
        text: `Surat resmi berhasil dibuat dengan nomor otomatis ${refNo} dan tersimpan di arsip.`,
      });
      await load();

      if (mode === 'download') {
        const a = document.createElement('a');
        a.href = `/api/modules/core/letter/${created.id}/pdf?download=1`;
        a.download = `surat-${refNo.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else if (mode === 'open') {
        window.open(`/api/modules/core/letter/${created.id}/pdf`, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Gagal membuat surat resmi.',
      });
    } finally {
      setSavingLetter(false);
    }
  }

  async function addManualRecord(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
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
      setMsg({ kind: 'ok', text: 'Arsip administrasi berhasil disimpan.' });
      await load();
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan arsip.',
      });
    }
  }

  async function confirmDeleteRecord() {
    if (!deleteTarget) return;
    setDeleting(true);
    setMsg(null);
    try {
      await apiFetch(`/api/modules/core?kind=record&id=${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      setMsg({ kind: 'ok', text: 'Arsip berhasil dihapus.' });
      await load();
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus arsip.',
      });
    } finally {
      setDeleting(false);
    }
  }

  const meetingCount = useMemo(
    () => records.filter((r) => r.recordType === 'MEETING').length,
    [records],
  );
  const letterCount = useMemo(
    () => records.filter((r) => r.recordType === 'LETTER').length,
    [records],
  );
  const visibleRecords = useMemo(() => {
    const q = archiveSearch.trim().toLowerCase();
    return records.filter((r) => {
      if (archiveFilter !== 'ALL' && r.recordType !== archiveFilter) return false;
      if (
        q &&
        !r.title.toLowerCase().includes(q) &&
        !(r.referenceNo || '').toLowerCase().includes(q) &&
        !(r.summary || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [records, archiveFilter, archiveSearch]);

  const isCertStyle = activeTemplate.style === 'certificate';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Administrasi & Generator Surat Resmi
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Template cetak surat otomatis dengan kop surat, tata naskah baku, dan penomoran surat
            berurutan otomatis, serta arsip notulen rapat.
          </p>
        </div>
      </div>

      {msg && (
        <div
          className={`no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-sm backdrop-blur-sm ${
            msg.kind === 'ok'
              ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-800'
              : 'border-rose-200/80 bg-rose-50/80 text-rose-800'
          }`}
        >
          <span>{msg.text}</span>
          {lastGenerated && msg.kind === 'ok' && (
            <div className="flex items-center gap-2">
              <a
                href={`/api/modules/core/letter/${lastGenerated.id}/pdf?download=1`}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Download className="h-3.5 w-3.5" /> Unduh PDF
              </a>
              <a
                href={`/api/modules/core/letter/${lastGenerated.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-xl bg-white/90 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-white"
              >
                <Printer className="h-3.5 w-3.5" /> Buka Cetak
              </a>
            </div>
          )}
        </div>
      )}

      {/* 3 Kartu Ringkasan Administrasi */}
      <div className="no-print grid gap-4 sm:grid-cols-3">
        <Card className="aurora-card-blend">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Total Arsip</span>
              <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-violet-600">
                <FolderKanban className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2.5 text-2xl font-bold text-slate-900">{records.length}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Surat resmi & notulen rapat</p>
          </CardContent>
        </Card>

        <Card className="aurora-card-purple">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Surat Resmi Terbit</span>
              <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-violet-600">
                <Mail className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2.5 text-2xl font-bold text-violet-700">{letterCount}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Nomor berikutnya: <span className="font-mono font-semibold">{previewLetterNo}</span>
            </p>
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
            <p className="mt-2.5 text-2xl font-bold text-emerald-700">{meetingCount}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Catatan hasil rapat internal</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="no-print glass-tile inline-flex flex-wrap gap-1 rounded-xl p-1 text-xs font-medium">
        {[
          { id: 'builder', label: 'Buat & Cetak Surat (Template)', icon: Sparkles },
          { id: 'archive', label: `Arsip Surat & Notulen (${records.length})`, icon: Archive },
          { id: 'manual', label: 'Catat Notulen / Surat Masuk', icon: FilePlus2 },
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

      {/* TAB 1: TEMPLATE LETTER BUILDER + LIVE A4 PREVIEW */}
      {tab === 'builder' && (
        <div className="grid gap-6 xl:grid-cols-12">
          {/* LEFT: Template Picker & Secretary Form */}
          <div className="no-print space-y-5 xl:col-span-6">
            {/* Step 1: Pilih Template */}
            <Card>
              <CardHeader className="border-b border-white/60 pb-3.5">
                <CardTitle className="text-base">1. Pilih Template Surat</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {LETTER_TEMPLATES.map((tpl) => {
                    const selected = letterForm.templateCode === tpl.code;
                    return (
                      <button
                        key={tpl.code}
                        type="button"
                        onClick={() => selectTemplate(tpl.code)}
                        className={`rounded-2xl border p-3 text-left transition ${
                          selected
                            ? 'border-violet-400 bg-gradient-to-br from-emerald-50/90 via-white to-violet-50/95 shadow-sm ring-2 ring-violet-400/35'
                            : 'border-white/80 bg-white/55 hover:bg-white/85'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">{tpl.name}</span>
                          <span
                            className={`rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold ${
                              selected
                                ? 'bg-brand-gradient text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {tpl.code}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-slate-500">
                          {tpl.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Isi Kolom Surat */}
            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-white/60 pb-3.5">
                <CardTitle className="text-base">
                  2. Isi Data Surat ({activeTemplate.name})
                </CardTitle>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/80 bg-emerald-50/85 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-800">
                  <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                  AUTO: {previewLetterNo}
                </span>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Metadata dasar */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <FieldGroup label="Tanggal Surat" required>
                    <input
                      type="date"
                      required
                      value={letterForm.letterDate}
                      onChange={(e) => setLetterForm({ ...letterForm, letterDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm"
                    />
                  </FieldGroup>
                  <FieldGroup label="Kota">
                    <input
                      placeholder="Bandung"
                      value={letterForm.city}
                      onChange={(e) => setLetterForm({ ...letterForm, city: e.target.value })}
                      className="w-full px-3 py-2 text-sm"
                    />
                  </FieldGroup>
                  {!isCertStyle ? (
                    <FieldGroup label="Lampiran">
                      <input
                        placeholder="- / 1 berkas"
                        value={letterForm.attachment}
                        onChange={(e) =>
                          setLetterForm({ ...letterForm, attachment: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm"
                      />
                    </FieldGroup>
                  ) : (
                    <FieldGroup label="Periode Kepengurusan">
                      <input
                        placeholder="2026/2027"
                        value={letterForm.periodName}
                        onChange={(e) =>
                          setLetterForm({ ...letterForm, periodName: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm"
                      />
                    </FieldGroup>
                  )}
                </div>

                <FieldGroup label="Perihal / Judul Surat" required>
                  <input
                    required
                    placeholder="Contoh: Undangan Kuliah Umum Enterprise Architecture"
                    value={letterForm.subject}
                    onChange={(e) => setLetterForm({ ...letterForm, subject: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm"
                  />
                </FieldGroup>

                {/* Correspondence fields (UND / PMH / PJM / UMM) */}
                {!isCertStyle && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FieldGroup label="Tujuan — Kepada Yth." required>
                        <input
                          placeholder="Contoh: Kepala Bagian Sarana Prasarana / Dr. Budi Santoso"
                          value={letterForm.recipientName}
                          onChange={(e) =>
                            setLetterForm({ ...letterForm, recipientName: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm"
                        />
                      </FieldGroup>
                      <FieldGroup label="Instansi / Jabatan Tujuan">
                        <input
                          placeholder="Contoh: Fakultas Rekayasa Industri / PT Nusantara"
                          value={letterForm.recipientOrg}
                          onChange={(e) =>
                            setLetterForm({ ...letterForm, recipientOrg: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm"
                        />
                      </FieldGroup>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <FieldGroup
                        label="Keperluan / Nama Kegiatan"
                        required
                        className="sm:col-span-2"
                      >
                        <input
                          placeholder="Contoh: Kuliah Umum Enterprise Architecture 2026"
                          value={letterForm.purpose}
                          onChange={(e) =>
                            setLetterForm({ ...letterForm, purpose: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm"
                        />
                      </FieldGroup>
                      <FieldGroup label="di (Tempat / Kota)">
                        <input
                          placeholder="Tempat / Bandung"
                          value={letterForm.recipientPlace}
                          onChange={(e) =>
                            setLetterForm({ ...letterForm, recipientPlace: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm"
                        />
                      </FieldGroup>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <FieldGroup label="Hari, Tanggal Pelaksanaan">
                        <input
                          placeholder="Sabtu, 5 Desember 2026"
                          value={letterForm.eventDate}
                          onChange={(e) =>
                            setLetterForm({ ...letterForm, eventDate: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm"
                        />
                      </FieldGroup>
                      <FieldGroup label="Waktu">
                        <input
                          placeholder="09.00 – 12.00 WIB"
                          value={letterForm.eventTime}
                          onChange={(e) =>
                            setLetterForm({ ...letterForm, eventTime: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm"
                        />
                      </FieldGroup>
                      <FieldGroup
                        label={
                          letterForm.templateCode === 'PJM' ? 'Lokasi / PIC' : 'Tempat / Lokasi'
                        }
                      >
                        <input
                          placeholder="Auditorium Gedung A"
                          value={letterForm.eventLocation}
                          onChange={(e) =>
                            setLetterForm({ ...letterForm, eventLocation: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm"
                        />
                      </FieldGroup>
                    </div>

                    <FieldGroup
                      label={
                        letterForm.templateCode === 'PJM'
                          ? 'Ruangan / Daftar Barang Dipinjam'
                          : letterForm.templateCode === 'PMH'
                            ? 'Rincian Permohonan'
                            : letterForm.templateCode === 'UND'
                              ? 'Agenda / Acara (Opsional)'
                              : 'Keterangan Tambahan (Opsional)'
                      }
                    >
                      <input
                        placeholder={
                          letterForm.templateCode === 'PJM'
                            ? 'Ruang Auditorium Lt. 2, 2 Mikrofon Wireless, 1 Proyektor'
                            : 'Detail tambahan yang tampil di tabel isi surat...'
                        }
                        value={letterForm.itemDetails}
                        onChange={(e) =>
                          setLetterForm({ ...letterForm, itemDetails: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm"
                      />
                    </FieldGroup>
                  </>
                )}

                {/* Certificate / Assignment fields (SKT / STG) */}
                {isCertStyle && (
                  <>
                    {members.length > 0 && (
                      <FieldGroup label="Isi Cepat dari Data Anggota EISD (Opsional)">
                        <GlassSelect
                          value=""
                          onChange={autofillFromMember}
                          placeholder="Pilih anggota untuk isi otomatis Nama, NIM, Divisi..."
                          options={members.map((m) => ({
                            value: m.id,
                            label: `${m.fullName} (${m.nim})`,
                            hint: `${m.divisionName} · ${m.positionTitle}`,
                          }))}
                        />
                      </FieldGroup>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <FieldGroup label="Nama Lengkap Anggota / Tim" required>
                        <input
                          placeholder="Contoh: Dimas Saputra"
                          value={letterForm.memberName}
                          onChange={(e) =>
                            setLetterForm({ ...letterForm, memberName: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm"
                        />
                      </FieldGroup>
                      <FieldGroup label="NIM">
                        <input
                          placeholder="Contoh: 1202220004"
                          value={letterForm.memberNim}
                          onChange={(e) =>
                            setLetterForm({ ...letterForm, memberNim: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm"
                        />
                      </FieldGroup>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <FieldGroup label="Divisi / Jabatan">
                        <input
                          placeholder="Contoh: Divisi Event — Kadiv Event"
                          value={letterForm.memberDivision}
                          onChange={(e) =>
                            setLetterForm({ ...letterForm, memberDivision: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm"
                        />
                      </FieldGroup>
                      <FieldGroup
                        label={
                          letterForm.templateCode === 'STG'
                            ? 'Keperluan / Nama Penugasan'
                            : 'Keperluan Surat Keterangan'
                        }
                        required
                      >
                        <input
                          placeholder={
                            letterForm.templateCode === 'STG'
                              ? 'Delegasi Final GEMASTIK 2026'
                              : 'Pengajuan SKPI / Beasiswa / Magang'
                          }
                          value={letterForm.purpose}
                          onChange={(e) =>
                            setLetterForm({ ...letterForm, purpose: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm"
                        />
                      </FieldGroup>
                    </div>

                    {letterForm.templateCode === 'STG' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FieldGroup label="Tanggal Pelaksanaan">
                          <input
                            placeholder="18 – 20 Desember 2026"
                            value={letterForm.eventDate}
                            onChange={(e) =>
                              setLetterForm({ ...letterForm, eventDate: e.target.value })
                            }
                            className="w-full px-3.5 py-2 text-sm"
                          />
                        </FieldGroup>
                        <FieldGroup label="Lokasi / Penyelenggara">
                          <input
                            placeholder="Universitas Indonesia / Puspresnas"
                            value={letterForm.eventLocation}
                            onChange={(e) =>
                              setLetterForm({ ...letterForm, eventLocation: e.target.value })
                            }
                            className="w-full px-3.5 py-2 text-sm"
                          />
                        </FieldGroup>
                      </div>
                    )}
                  </>
                )}

                <FieldGroup
                  label={
                    letterForm.templateCode === 'UMM'
                      ? 'Isi Pokok Surat'
                      : 'Paragraf Tambahan / Catatan Khusus (Opsional)'
                  }
                >
                  <textarea
                    rows={3}
                    placeholder="Kosongkan jika susunan paragraf otomatis di preview sudah sesuai, atau tulis catatan tambahan di sini..."
                    value={letterForm.customBody}
                    onChange={(e) => setLetterForm({ ...letterForm, customBody: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm"
                  />
                </FieldGroup>

                {/* Penandatangan */}
                <div className="rounded-2xl border border-white/75 bg-white/55 p-3.5">
                  <p className="mb-2.5 text-xs font-semibold text-slate-700">
                    Penandatangan Surat (Default Pengurus Core)
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <FieldGroup label="Nama Ketua Lab">
                      <input
                        value={letterForm.chairName}
                        onChange={(e) =>
                          setLetterForm({ ...letterForm, chairName: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-xs"
                      />
                    </FieldGroup>
                    <FieldGroup label="NIM / NIP Ketua">
                      <input
                        value={letterForm.chairId}
                        onChange={(e) => setLetterForm({ ...letterForm, chairId: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs"
                      />
                    </FieldGroup>
                    <FieldGroup label="Nama Sekretaris Lab">
                      <input
                        value={letterForm.secretaryName}
                        onChange={(e) =>
                          setLetterForm({ ...letterForm, secretaryName: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-xs"
                      />
                    </FieldGroup>
                    <FieldGroup label="NIM / NIP Sekretaris">
                      <input
                        value={letterForm.secretaryId}
                        onChange={(e) =>
                          setLetterForm({ ...letterForm, secretaryId: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-xs"
                      />
                    </FieldGroup>
                  </div>
                </div>

                {/* Action buttons */}
                {canManage ? (
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      disabled={savingLetter || !letterForm.subject.trim()}
                      onClick={() => void saveAndExportLetter('download')}
                      className="btn-brand inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {savingLetter ? 'Menyimpan...' : 'Simpan & Download PDF (A4)'}
                    </button>
                    <button
                      type="button"
                      disabled={savingLetter || !letterForm.subject.trim()}
                      onClick={() => void saveAndExportLetter('open')}
                      className="glass-tile inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-violet-800 hover:bg-white/95 disabled:opacity-50"
                    >
                      <Printer className="h-3.5 w-3.5" /> Simpan & Buka Cetak
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Akun Anda berada dalam mode lihat saja (butuh izin kelola arsip administrasi
                    untuk menerbitkan surat).
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Live A4 Paper Preview */}
          <div className="xl:col-span-6">
            <div className="xl:sticky xl:top-20">
              <div className="no-print mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-700">
                    Live Preview Format Surat Resmi (A4)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white/95"
                >
                  <Printer className="h-3.5 w-3.5 text-violet-600" /> Cetak Preview
                </button>
              </div>
              <LetterPaperPreview payload={letterForm} referenceNo={previewLetterNo} compact />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ARSIP SURAT & NOTULEN */}
      {tab === 'archive' && (
        <Card className="no-print">
          <CardHeader className="flex flex-col gap-3 border-b border-white/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>Daftar Arsip ({visibleRecords.length})</CardTitle>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  placeholder="Cari nomor surat, judul..."
                  className="w-full py-1.5 pl-8 pr-3 text-xs"
                />
              </div>
              <div className="glass-tile inline-flex rounded-xl p-1 text-xs font-medium">
                {[
                  { id: 'ALL', label: `Semua (${records.length})` },
                  { id: 'LETTER', label: `Surat (${letterCount})` },
                  { id: 'MEETING', label: `Notulen (${meetingCount})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setArchiveFilter(t.id as 'ALL' | 'MEETING' | 'LETTER')}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      archiveFilter === t.id
                        ? 'bg-brand-gradient font-semibold text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-white/60 pt-2 text-sm">
            {visibleRecords.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-500">
                Belum ada arsip surat atau notulen yang cocok.
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
                      {r.templateCode && (
                        <span className="rounded-lg bg-emerald-100/90 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                          {r.templateCode}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {r.recordDate.slice(0, 10)}
                      {r.referenceNo ? (
                        <>
                          {' '}
                          · No:{' '}
                          <span className="font-mono font-semibold text-slate-700">
                            {r.referenceNo}
                          </span>
                        </>
                      ) : null}
                    </p>
                    {r.summary && <p className="mt-1.5 text-xs text-slate-600">{r.summary}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {r.letterDataJson && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPreviewRecord(r)}
                          className="glass-tile inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white/95"
                        >
                          <Eye className="h-3.5 w-3.5 text-violet-600" /> Preview
                        </button>
                        <a
                          href={`/api/modules/core/letter/${r.id}/pdf?download=1`}
                          className="btn-brand inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
                        >
                          <Download className="h-3.5 w-3.5" /> PDF A4
                        </a>
                      </>
                    )}
                    {r.documentUrl && (
                      <a
                        href={r.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="glass-tile inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-white/95"
                      >
                        Dokumen <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            id: r.id,
                            title: r.title,
                            referenceNo: r.referenceNo,
                          })
                        }
                        title="Hapus arsip"
                        className="rounded-xl p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: CATAT NOTULEN / SURAT MASUK MANUAL */}
      {tab === 'manual' && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Catat Notulen Rapat atau Arsip Surat Masuk</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <form onSubmit={(e) => void addManualRecord(e)} className="grid gap-3 md:grid-cols-3">
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
                      {
                        value: 'LETTER',
                        label: 'Surat Masuk / Manual',
                        hint: 'Arsip surat eksternal yang diterima',
                      },
                    ]}
                  />
                </FieldGroup>
                <FieldGroup label="No. Surat / Referensi">
                  <input
                    placeholder="Mis. 012/EXT/XI/2026"
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
            ) : (
              <p className="text-xs text-slate-500">
                Akun Anda tidak memiliki izin menambah arsip notulen atau surat.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODAL PREVIEW SURAT TERSIMPAN */}
      {previewRecord && previewRecord.letterDataJson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
          onClick={() => setPreviewRecord(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/75 bg-white/90 p-5 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{previewRecord.title}</p>
                <p className="font-mono text-xs text-slate-500">
                  {previewRecord.referenceNo || '-'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                >
                  <Printer className="h-3.5 w-3.5 text-violet-600" /> Cetak
                </button>
                <a
                  href={`/api/modules/core/letter/${previewRecord.id}/pdf?download=1`}
                  className="btn-brand inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewRecord(null)}
                  className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <LetterPaperPreview
              payload={previewRecord.letterDataJson}
              referenceNo={previewRecord.referenceNo || '-'}
            />
          </div>
        </div>
      )}

      {/* Centered Glass Confirm Dialog: Delete Archive Record */}
      <GlassConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Arsip Administrasi?"
        description={
          deleteTarget
            ? `Arsip "${deleteTarget.title}"${deleteTarget.referenceNo ? ` (${deleteTarget.referenceNo})` : ''} akan dihapus dari daftar arsip.`
            : ''
        }
        confirmLabel="Ya, Hapus Arsip"
        cancelLabel="Batal"
        variant="danger"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteRecord()}
      />
    </div>
  );
}
