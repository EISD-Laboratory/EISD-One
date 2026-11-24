'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader } from '@/components/ui';

interface AuditRow {
  id: string;
  actorEmail: string | null;
  action: string;
  module: string;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    void apiFetch<{ items: AuditRow[] }>(`/api/audit-logs${qs}`)
      .then((d) => setItems(d.items))
      .catch(() => undefined);
  }, [search]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Log (Read-Only)</h1>
        <p className="text-sm text-slate-500">
          Seluruh perubahan penting tercatat otomatis dan bersifat append-only.
        </p>
      </div>
      <Card>
        <CardHeader>
          <input
            placeholder="Cari aksi atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {items.map((log) => (
            <div key={log.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{log.module}</Badge>
                  <span className="font-mono text-xs font-semibold">{log.action}</span>
                  <span className="text-xs text-slate-500">oleh {log.actorEmail || 'system'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>
                    {new Date(log.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === log.id ? null : log.id)}
                    className="underline"
                  >
                    Diff
                  </button>
                </div>
              </div>
              {openId === log.id && (
                <div className="mt-2 grid gap-2 border-t border-slate-100 pt-2 md:grid-cols-2">
                  <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">
                    {JSON.stringify(log.beforeData, null, 2)}
                  </pre>
                  <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">
                    {JSON.stringify(log.afterData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
