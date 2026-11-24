'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, Upload } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
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
    await apiFetch('/api/modules/praktikum', { method: 'POST', body: JSON.stringify(form) });
    setForm({ code: '', name: '', semester: 'Ganjil 2026/2027', schedule: '' });
    await load();
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    if (!file || !importCourseId) return;
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
    setMsg(`Impor ${recordType} selesai: ${res.successCount} berhasil, ${res.failedCount} gagal.`);
    setFile(null);
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Modul Praktikum</h1>
          <p className="text-sm text-slate-500">
            Kelas, jadwal, impor nilai & presensi dari Excel/CSV (presensi asisten otomatis memasok
            KPI <code>praktikum.attendance_rate</code>).
          </p>
        </div>
        <a
          href="/api/modules/praktikum?template=true&format=xlsx"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
        >
          <Download className="h-3.5 w-3.5" /> Template Excel
        </a>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {hasPermission('praktikum.course.manage') && (
          <Card>
            <CardHeader>
              <CardTitle>Tambah Kelas Praktikum</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void addCourse(e)} className="grid gap-2 sm:grid-cols-2">
                <input
                  required
                  placeholder="Kode (EISD-PRK-102)"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  required
                  placeholder="Nama Kelas"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  required
                  placeholder="Semester"
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  placeholder="Jadwal"
                  value={form.schedule}
                  onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="rounded bg-slate-900 py-1.5 text-xs font-medium text-white sm:col-span-2"
                >
                  Simpan Kelas
                </button>
              </form>
            </CardContent>
          </Card>
        )}

        {hasPermission('praktikum.grade.import') && (
          <Card>
            <CardHeader>
              <CardTitle>Impor Nilai / Presensi dari Excel</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleImport(e)} className="grid gap-2 sm:grid-cols-2">
                <select
                  required
                  value={importCourseId}
                  onChange={(e) => setImportCourseId(e.target.value)}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={recordType}
                  onChange={(e) => setRecordType(e.target.value as 'GRADE' | 'ATTENDANCE')}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                >
                  <option value="GRADE">Impor Nilai (GRADE)</option>
                  <option value="ATTENDANCE">Impor Presensi (ATTENDANCE)</option>
                </select>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="rounded border border-slate-300 px-2.5 py-1 text-xs sm:col-span-2"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded bg-emerald-700 py-1.5 text-xs font-medium text-white sm:col-span-2"
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
                <CardTitle>
                  {c.name} <Badge variant="secondary">{c.code}</Badge>
                </CardTitle>
                <p className="text-xs text-slate-500">
                  {c.semester} · {c.schedule || '-'}
                </p>
              </div>
              <a
                href={`/api/modules/praktikum?exportCourseId=${c.id}&format=xlsx`}
                className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs"
              >
                <Download className="h-3 w-3" /> Export Rekap XLSX
              </a>
            </div>
          </CardHeader>
          <CardContent className="text-xs">
            {c.records.length === 0 ? (
              <p className="text-slate-400">
                Belum ada data presensi/nilai. Gunakan form Impor Excel di atas.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {c.records.slice(0, 20).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5">
                    <span>
                      <strong>{r.studentName}</strong> ({r.studentNim || '-'}) · {r.sessionLabel}
                    </span>
                    <Badge variant="secondary">
                      {r.recordType === 'GRADE'
                        ? `Nilai: ${r.score}`
                        : r.isPresent
                          ? 'HADIR'
                          : 'TIDAK HADIR'}
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
