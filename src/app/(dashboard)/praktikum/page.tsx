'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BookOpen, Download, Plus, Upload } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { FieldGroup, GlassFileDropzone, GlassSelect } from '@/components/glass-inputs';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface PraktikumCourse {
  id: string;
  code: string;
  name: string;
  semester: string;
  schedule: string | null;
  records: Array<{
    id: string;
    recordType: 'ATTENDANCE' | 'GRADE';
    sessionLabel: string;
    recordDate: string;
    studentNim: string | null;
    studentName: string;
    isPresent: boolean | null;
    score: number | null;
  }>;
}

export default function PraktikumModulePage() {
  const { hasPermission } = useAuth();
  const [courses, setCourses] = useState<PraktikumCourse[]>([]);
  const [form, setForm] = useState({
    code: '',
    name: '',
    semester: 'Ganjil 2026/2027',
    schedule: '',
  });
  const [importCourseId, setImportCourseId] = useState('');
  const [recordType, setRecordType] = useState<'GRADE' | 'ATTENDANCE'>('GRADE');
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<PraktikumCourse[]>('/api/modules/praktikum');
    setCourses(res);
    if (!importCourseId && res.length > 0) setImportCourseId(res[0].id);
  }, [importCourseId]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  async function addCourse(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/api/modules/praktikum', { method: 'POST', body: JSON.stringify(form) });
      setForm({ code: '', name: '', semester: 'Ganjil 2026/2027', schedule: '' });
      setMsg('Kelas praktikum baru berhasil ditambahkan.');
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Gagal menambah kelas.');
    }
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!file || !importCourseId) {
      setErr('Pilih kelas dan unggah file Excel/CSV terlebih dahulu.');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('courseId', importCourseId);
      fd.append('recordType', recordType);
      fd.append('file', file);
      const res = await apiFetch<{ successCount: number; failedCount: number }>(
        '/api/modules/praktikum',
        {
          method: 'POST',
          body: fd,
        },
      );
      setMsg(
        `Impor ${recordType} selesai: ${res.successCount} berhasil, ${res.failedCount} gagal.`,
      );
      setFile(null);
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Gagal mengimpor file.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Modul Praktikum</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Kelas, jadwal, impor nilai & presensi dari Excel/CSV (presensi asisten otomatis memasok
            KPI{' '}
            <code className="rounded-md bg-violet-50 px-1.5 py-0.5 text-xs text-violet-700">
              praktikum.attendance_rate
            </code>
            ).
          </p>
        </div>
        <a
          href="/api/modules/praktikum?template=true&format=xlsx"
          className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-violet-800 transition hover:bg-white/90"
        >
          <Download className="h-3.5 w-3.5 text-emerald-600" /> Unduh Template Excel
        </a>
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

      <div className="grid gap-6 lg:grid-cols-2">
        {hasPermission('praktikum.course.manage') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gradient-soft text-violet-700">
                  <BookOpen className="h-4 w-4" />
                </span>
                Tambah Kelas Praktikum
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void addCourse(e)} className="grid gap-3.5 sm:grid-cols-2">
                <FieldGroup label="Kode Mata Kuliah" required>
                  <input
                    required
                    placeholder="Mis. EISD-PRK-102"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Nama Kelas" required>
                  <input
                    required
                    placeholder="Mis. Praktikum Basis Data"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Semester" required>
                  <input
                    required
                    placeholder="Ganjil 2026/2027"
                    value={form.semester}
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Jadwal Pelaksanaan">
                  <input
                    placeholder="Mis. Rabu 13:00 - 15:00 WIB"
                    value={form.schedule}
                    onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm"
                  />
                </FieldGroup>
                <button
                  type="submit"
                  className="btn-brand inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold sm:col-span-2"
                >
                  <Plus className="h-4 w-4" /> Simpan Kelas
                </button>
              </form>
            </CardContent>
          </Card>
        )}

        {hasPermission('praktikum.grade.import') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50/90 text-emerald-600">
                  <Upload className="h-4 w-4" />
                </span>
                Impor Nilai / Presensi dari Excel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleImport(e)} className="grid gap-3.5 sm:grid-cols-2">
                <FieldGroup label="Pilih Kelas Praktikum" required>
                  <GlassSelect
                    value={importCourseId}
                    onChange={setImportCourseId}
                    placeholder="Pilih kelas..."
                    options={courses.map((c) => ({
                      value: c.id,
                      label: `${c.code} — ${c.name}`,
                      hint: c.semester,
                    }))}
                  />
                </FieldGroup>
                <FieldGroup label="Jenis Data Impor" required>
                  <GlassSelect
                    value={recordType}
                    onChange={(v) => setRecordType(v as 'GRADE' | 'ATTENDANCE')}
                    options={[
                      {
                        value: 'GRADE',
                        label: 'Impor Nilai (GRADE)',
                        hint: 'Rekap skor praktikan',
                      },
                      {
                        value: 'ATTENDANCE',
                        label: 'Impor Presensi (ATTENDANCE)',
                        hint: 'Otomatis memasok KPI asisten',
                      },
                    ]}
                  />
                </FieldGroup>
                <FieldGroup label="File Excel / CSV" required className="sm:col-span-2">
                  <GlassFileDropzone
                    file={file}
                    onFileSelect={setFile}
                    accept=".xlsx,.csv"
                    hint="Unggah file .xlsx atau .csv sesuai Template Praktikum"
                  />
                </FieldGroup>
                <button
                  type="submit"
                  disabled={!file || !importCourseId}
                  className="btn-brand inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                >
                  <Upload className="h-3.5 w-3.5" /> Impor Sekarang
                </button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {courses.map((c) => (
        <Card key={c.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span>{c.name}</span>
                  <Badge variant="purple">{c.code}</Badge>
                </CardTitle>
                <p className="mt-0.5 text-xs text-slate-500">
                  {c.semester} · {c.schedule || '-'}
                </p>
              </div>
              <a
                href={`/api/modules/praktikum?exportCourseId=${c.id}&format=xlsx`}
                className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white/95 hover:text-violet-700"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600" /> Export Rekap XLSX
              </a>
            </div>
          </CardHeader>
          <CardContent className="text-xs">
            {c.records.length === 0 ? (
              <p className="text-slate-500">
                Belum ada data presensi/nilai. Gunakan form Impor Excel di atas.
              </p>
            ) : (
              <div className="divide-y divide-white/60">
                {c.records.slice(0, 20).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2">
                    <span>
                      <strong className="text-slate-900">{r.studentName}</strong> (
                      {r.studentNim || '-'}) · {r.sessionLabel}
                    </span>
                    <Badge
                      variant={
                        r.recordType === 'GRADE' ? 'purple' : r.isPresent ? 'success' : 'danger'
                      }
                    >
                      {r.recordType === 'GRADE'
                        ? `Nilai: ${r.score}`
                        : r.isPresent
                          ? '● HADIR'
                          : '● TIDAK HADIR'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
