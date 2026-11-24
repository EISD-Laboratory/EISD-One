'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { GlassSelect } from '@/components/glass-inputs';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface ResearchItem {
  id: string;
  title: string;
  type: 'RESEARCH' | 'PUBLICATION' | 'COMMUNITY_SERVICE';
  year: number;
  leadName: string | null;
  teamSummary: string | null;
  status: 'PROPOSAL' | 'ONGOING' | 'SUBMITTED' | 'PUBLISHED' | 'COMPLETED';
  venueOrPartner: string | null;
  documentUrl: string | null;
}

const STATUSES: ResearchItem['status'][] = [
  'PROPOSAL',
  'ONGOING',
  'SUBMITTED',
  'PUBLISHED',
  'COMPLETED',
];

export default function ResearchPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('research.project.manage');

  const [items, setItems] = useState<ResearchItem[]>([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ResearchItem['type']>('RESEARCH');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [leadName, setLeadName] = useState('');
  const [teamSummary, setTeamSummary] = useState('');
  const [venueOrPartner, setVenueOrPartner] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setItems(await apiFetch<ResearchItem[]>('/api/modules/research'));
  }

  useEffect(() => {
    void load().catch(() => {});
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    await apiFetch('/api/modules/research', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        title,
        type,
        year: Number(year),
        leadName: leadName || undefined,
        teamSummary: teamSummary || undefined,
        venueOrPartner: venueOrPartner || undefined,
        documentUrl: documentUrl || undefined,
      }),
    });
    setTitle('');
    setTeamSummary('');
    setVenueOrPartner('');
    setDocumentUrl('');
    setMsg('Proyek Riset / Komunitas berhasil ditambahkan.');
    await load();
  }

  async function handleStatus(id: string, status: ResearchItem['status']) {
    await apiFetch('/api/modules/research', {
      method: 'POST',
      body: JSON.stringify({ action: 'update', id, status }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Modul Research & Community</h1>
        <p className="text-sm text-slate-500">
          Pengelolaan proyek riset internal, publikasi paper/HAKI, dan kegiatan pengabdian
          masyarakat.
        </p>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </div>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Tambah Proyek / Publikasi / Pengabdian</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-3 md:grid-cols-3">
              <input
                required
                placeholder="Judul riset / paper / pengabdian *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              />
              <GlassSelect
                value={type}
                onChange={(v) => setType(v as ResearchItem['type'])}
                options={[
                  { value: 'RESEARCH', label: 'Riset' },
                  { value: 'PUBLICATION', label: 'Publikasi / HAKI' },
                  { value: 'COMMUNITY_SERVICE', label: 'Pengabdian Masyarakat' },
                ]}
              />
              <input
                type="number"
                required
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Nama Ketua Tim"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Jurnal / Konferensi / Mitra Komunitas"
                value={venueOrPartner}
                onChange={(e) => setVenueOrPartner(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Anggota tim"
                value={teamSummary}
                onChange={(e) => setTeamSummary(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Tautan DOI / Drive Dokumen"
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Simpan Proyek
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Portofolio Riset & Komunitas ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{item.title}</span>
                  <Badge variant="secondary">{item.type}</Badge>
                  <Badge variant="secondary">{item.year}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Ketua: {item.leadName || '-'} · Tim: {item.teamSummary || '-'}
                  {item.venueOrPartner ? ` · ${item.venueOrPartner}` : ''}
                </p>
              </div>
              {canManage ? (
                <GlassSelect
                  size="sm"
                  className="min-w-[140px]"
                  value={item.status}
                  onChange={(v) => void handleStatus(item.id, v as ResearchItem['status'])}
                  options={STATUSES.map((s) => ({ value: s, label: s }))}
                />
              ) : (
                <Badge variant="secondary">{item.status}</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
