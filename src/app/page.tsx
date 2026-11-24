import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/core/auth';
import { prisma } from '@/core/db';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) {
    redirect('/dashboard');
  }

  let dbHealthy = false;
  let divisions: Array<{ code: string; name: string; isEnabled: boolean }> = [];
  let publicEvents: Array<{ slug: string; title: string; startAt: Date }> = [];
  try {
    [divisions, publicEvents] = await Promise.all([
      prisma.division.findMany({
        where: { deletedAt: null },
        select: { code: true, name: true, isEnabled: true },
        orderBy: [{ isCustom: 'asc' }, { name: 'asc' }],
      }),
      prisma.eventItem.findMany({
        where: { deletedAt: null, isPublicOpen: true },
        select: { slug: true, title: true, startAt: true },
        orderBy: { startAt: 'asc' },
        take: 4,
      }),
    ]);
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">EISD One</h1>
            <Badge variant="secondary">Lean Modular Fullstack</Badge>
          </div>
          <p className="mt-1 text-slate-600">
            Satu sistem terpadu & modular per divisi untuk laboratorium EISD.
          </p>
        </div>
        <Link
          href="/login"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Masuk ke Dashboard →
        </Link>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Status Sistem</span>
              <Badge variant={dbHealthy ? 'success' : 'danger'}>
                {dbHealthy ? 'ONLINE' : 'DB OFFLINE'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>
              Arsitektur: <strong>2 Container</strong> (Next.js App + PostgreSQL)
            </p>
            <p>
              Inti aktif: Auth & RBAC, Data Anggota, Import/Export Excel & CSV, KPI Dinamis,
              Kalender, Custom Module Builder, Audit Log.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modul Divisi ({divisions.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {divisions.map((d) => (
              <Badge key={d.code} variant={d.isEnabled ? 'secondary' : 'danger'}>
                {d.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      {publicEvents.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Event Terbuka (Pendaftaran Publik)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {publicEvents.map((ev) => (
              <div
                key={ev.slug}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{ev.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(ev.startAt).toLocaleDateString('id-ID', {
                      dateStyle: 'medium',
                      timeZone: 'Asia/Jakarta',
                    })}
                  </p>
                </div>
                <Link
                  href={`/register/${ev.slug}`}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Daftar Sekarang
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
