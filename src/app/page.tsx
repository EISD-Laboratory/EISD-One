import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CalendarDays, Layers, ShieldCheck, Sparkles } from 'lucide-react';
import { getSessionUser } from '@/core/auth';
import { prisma } from '@/core/db';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) {
    redirect('/apps');
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
    <main className="aurora-hero relative min-h-screen overflow-hidden px-6 py-14">
      <div className="pointer-events-none absolute -top-20 -left-20 h-96 w-96 rounded-full bg-emerald-400/25 blur-3xl" />
      <div className="pointer-events-none absolute top-16 -right-24 h-[26rem] w-[26rem] rounded-full bg-violet-500/25 blur-3xl" />
      <div className="relative mx-auto max-w-5xl">
        <header className="glass-panel mb-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl p-7">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                EISD <span className="text-brand-gradient">One</span>
              </h1>
              <Badge variant="purple">Modular Platform</Badge>
            </div>
            <p className="max-w-xl text-sm text-slate-600">
              Platform internal terpadu & modular per divisi untuk operasional Laboratorium EISD —
              data anggota, KPI, kas, kegiatan, hingga Custom Module dalam satu workspace modern.
            </p>
          </div>
          <Link
            href="/login"
            className="btn-brand inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
          >
            Masuk ke Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="aurora-card-green">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Status Sistem
                </span>
                <Badge variant={dbHealthy ? 'success' : 'danger'}>
                  {dbHealthy ? '● ONLINE' : '● DB OFFLINE'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>
                Arsitektur: <strong className="text-slate-900">Lean Modular Fullstack</strong>{' '}
                (Next.js + PostgreSQL).
              </p>
              <p>
                Inti aktif: Auth & RBAC, Data Anggota, Import/Export Excel & CSV, KPI Lintas Modul,
                Kalender, Custom Module Builder, Audit Log.
              </p>
            </CardContent>
          </Card>

          <Card className="aurora-card-purple">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-violet-600" />
                Modul Divisi ({divisions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {divisions.map((d, i) => (
                <Badge
                  key={d.code}
                  variant={!d.isEnabled ? 'danger' : i % 2 === 0 ? 'success' : 'purple'}
                >
                  {d.name}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>

        {publicEvents.length > 0 && (
          <Card className="mt-6 overflow-hidden">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-emerald-600" />
                Event Terbuka (Pendaftaran Publik)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-4">
              {publicEvents.map((ev) => (
                <div
                  key={ev.slug}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-sm transition hover:border-violet-200 hover:bg-white"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{ev.title}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(ev.startAt).toLocaleDateString('id-ID', {
                        dateStyle: 'medium',
                        timeZone: 'Asia/Jakarta',
                      })}
                    </p>
                  </div>
                  <Link
                    href={`/register/${ev.slug}`}
                    className="btn-brand rounded-xl px-3.5 py-1.5 text-xs font-semibold"
                  >
                    Daftar Sekarang
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
