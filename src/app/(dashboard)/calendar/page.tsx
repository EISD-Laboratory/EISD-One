'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MapPin,
  Plus,
  RotateCcw,
  Tag,
  X,
} from 'lucide-react';
import { useBreadcrumb } from '@/components/app-shell';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { FieldGroup, GlassSelect } from '@/components/glass-inputs';
import { Badge, Card, CardContent } from '@/components/ui';

type CalendarView = 'day' | 'week' | 'month' | 'year' | 'schedule';

interface CalItem {
  id: string;
  title: string;
  description: string | null;
  category: 'EVENT' | 'PRAKTIKUM' | 'MEETING' | 'COMPETITION' | 'BIRTHDAY' | 'OTHER';
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string | null;
  divisionId: string | null;
  divisionName: string | null;
  divisionCode: string | null;
  sourceModule: string | null;
  isRecurringYearly: boolean;
}

interface DivisionOption {
  id: string;
  code: string;
  name: string;
  isEnabled: boolean;
}

const VIEW_TABS: Array<{ id: CalendarView; label: string }> = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'schedule', label: 'Schedule' },
];

const WEEKDAYS_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 - 22:00

const CATEGORY_STYLE: Record<
  CalItem['category'],
  { pill: string; dot: string; label: string; border: string }
> = {
  EVENT: {
    pill: 'bg-violet-100/90 text-violet-800 border-violet-300/80',
    dot: 'bg-violet-500',
    label: 'Event',
    border: 'border-l-violet-500',
  },
  MEETING: {
    pill: 'bg-emerald-100/90 text-emerald-800 border-emerald-300/80',
    dot: 'bg-emerald-500',
    label: 'Rapat',
    border: 'border-l-emerald-500',
  },
  PRAKTIKUM: {
    pill: 'bg-sky-100/90 text-sky-800 border-sky-300/80',
    dot: 'bg-sky-500',
    label: 'Praktikum',
    border: 'border-l-sky-500',
  },
  COMPETITION: {
    pill: 'bg-amber-100/90 text-amber-800 border-amber-300/80',
    dot: 'bg-amber-500',
    label: 'Lomba',
    border: 'border-l-amber-500',
  },
  BIRTHDAY: {
    pill: 'bg-pink-100/90 text-pink-800 border-pink-300/80',
    dot: 'bg-pink-500',
    label: 'Ulang Tahun',
    border: 'border-l-pink-500',
  },
  OTHER: {
    pill: 'bg-slate-100/90 text-slate-700 border-slate-300/80',
    dot: 'bg-slate-500',
    label: 'Lainnya',
    border: 'border-l-slate-400',
  },
};

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function getMonthGridDays(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = startOfWeekMonday(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => {
    const dt = new Date(gridStart);
    dt.setDate(gridStart.getDate() + i);
    return dt;
  });
}

function formatTimeWib(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

export default function CalendarPage() {
  const { user, hasPermission } = useAuth();
  const { setExtraCrumbs } = useBreadcrumb();
  const canManage = hasPermission('calendar.item.manage');

  const [items, setItems] = useState<CalItem[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [divisionFilter, setDivisionFilter] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<CalItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
      title: '',
      divisionId: '',
      category: 'MEETING' as CalItem['category'],
      startDate: toLocalDateInput(start),
      startTime: toLocalTimeInput(start),
      endDate: toLocalDateInput(end),
      endTime: toLocalTimeInput(end),
      location: '',
      description: '',
    };
  });

  const load = useCallback(async () => {
    const [calRes, divRes] = await Promise.all([
      apiFetch<CalItem[]>('/api/calendar'),
      apiFetch<DivisionOption[]>('/api/divisions').catch(() => [] as DivisionOption[]),
    ]);
    setItems(calRes);
    setDivisions(divRes.filter((d) => d.isEnabled));
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  const selectableDivisions = useMemo(() => {
    const canManageAll = user?.isSuperAdmin || hasPermission('member.member.view_all');
    if (canManageAll) return divisions;
    const allowed = new Set(
      (user?.roles ?? []).map((r) => r.divisionId).filter((id): id is string => Boolean(id)),
    );
    return divisions.filter((d) => allowed.has(d.id));
  }, [divisions, user, hasPermission]);

  useEffect(() => {
    const tabLabel = VIEW_TABS.find((t) => t.id === view)?.label ?? 'Month';
    const crumbs: Array<{ label: string; onClick?: () => void }> = [{ label: tabLabel }];
    if (categoryFilter) {
      const catLabel = CATEGORY_STYLE[categoryFilter as CalItem['category']]?.label;
      if (catLabel) crumbs.push({ label: catLabel });
    }
    if (divisionFilter) {
      const divLabel =
        divisionFilter === '__GENERAL__'
          ? 'Umum'
          : divisions.find((d) => d.id === divisionFilter)?.name;
      if (divLabel) crumbs.push({ label: divLabel });
    }
    setExtraCrumbs(crumbs);
  }, [view, categoryFilter, divisionFilter, divisions, setExtraCrumbs]);

  useEffect(() => {
    if (!showAdd) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) setShowAdd(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAdd, saving]);

  // Hitung jumlah agenda per kategori & per divisi untuk badge sidebar
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of items) {
      counts[it.category] = (counts[it.category] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const divisionCounts = useMemo(() => {
    const counts: Record<string, number> = { __GENERAL__: 0 };
    for (const it of items) {
      if (!it.divisionId) counts.__GENERAL__ += 1;
      else counts[it.divisionId] = (counts[it.divisionId] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  // Proyeksikan event (termasuk ulang tahun tahunan pada tahun yang sedang dilihat)
  const projectedItems = useMemo(() => {
    const targetYear = cursor.getFullYear();
    return items
      .filter((it) => {
        if (categoryFilter && it.category !== categoryFilter) return false;
        if (!divisionFilter) return true;
        if (divisionFilter === '__GENERAL__') return !it.divisionId;
        return it.divisionId === divisionFilter;
      })
      .map((it) => {
        const start = new Date(it.startAt);
        const end = new Date(it.endAt);
        if (it.isRecurringYearly) {
          const pStart = new Date(
            targetYear,
            start.getMonth(),
            start.getDate(),
            start.getHours(),
            start.getMinutes(),
          );
          const dur = Math.max(60 * 60 * 1000, end.getTime() - start.getTime());
          const pEnd = new Date(pStart.getTime() + dur);
          return { ...it, _start: pStart, _end: pEnd };
        }
        return { ...it, _start: start, _end: end };
      })
      .sort((a, b) => a._start.getTime() - b._start.getTime());
  }, [items, categoryFilter, divisionFilter, cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Array<CalItem & { _start: Date; _end: Date }>>();
    for (const ev of projectedItems) {
      const startDay = new Date(ev._start.getFullYear(), ev._start.getMonth(), ev._start.getDate());
      const endDay = new Date(ev._end.getFullYear(), ev._end.getMonth(), ev._end.getDate());
      const spanDays = Math.min(
        31,
        Math.max(0, Math.round((endDay.getTime() - startDay.getTime()) / 86400000)),
      );
      const effectiveSpan = ev.allDay && spanDays >= 1 ? spanDays - 1 : spanDays;
      for (let d = 0; d <= effectiveSpan; d += 1) {
        const cur = new Date(startDay);
        cur.setDate(startDay.getDate() + d);
        const k = dateKey(cur);
        const list = map.get(k) ?? [];
        list.push(ev);
        map.set(k, list);
      }
    }
    return map;
  }, [projectedItems]);

  function openAddForDate(targetDate: Date) {
    if (!canManage) return;
    setFormError(null);
    const start = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      9,
      0,
    );
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setForm((prev) => ({
      ...prev,
      startDate: toLocalDateInput(start),
      startTime: toLocalTimeInput(start),
      endDate: toLocalDateInput(end),
      endTime: toLocalTimeInput(end),
      divisionId:
        prev.divisionId ||
        (!user?.isSuperAdmin && selectableDivisions.length === 1 ? selectableDivisions[0].id : ''),
    }));
    setShowAdd(true);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const startLocal = new Date(`${form.startDate}T${form.startTime || '00:00'}`);
    const endLocal = new Date(`${form.endDate}T${form.endTime || '00:00'}`);
    if (Number.isNaN(startLocal.getTime()) || Number.isNaN(endLocal.getTime())) {
      setFormError('Tanggal dan jam mulai/selesai wajib diisi dengan benar.');
      return;
    }
    if (endLocal.getTime() < startLocal.getTime()) {
      setFormError('Tanggal & jam selesai tidak boleh lebih awal dari tanggal & jam mulai.');
      return;
    }

    setSaving(true);
    try {
      await apiFetch('/api/calendar', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          divisionId: form.divisionId || null,
          category: form.category,
          startAt: startLocal.toISOString(),
          endAt: endLocal.toISOString(),
          allDay: false,
          location: form.location,
          description: form.description || undefined,
        }),
      });
      setForm((prev) => ({ ...prev, title: '', location: '', description: '' }));
      setShowAdd(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan agenda.');
    } finally {
      setSaving(false);
    }
  }

  function shiftPeriod(dir: -1 | 1) {
    setCursor((prev) => {
      const next = new Date(prev);
      if (view === 'day') next.setDate(next.getDate() + dir);
      else if (view === 'week') next.setDate(next.getDate() + dir * 7);
      else if (view === 'month' || view === 'schedule') next.setMonth(next.getMonth() + dir);
      else if (view === 'year') next.setFullYear(next.getFullYear() + dir);
      return next;
    });
  }

  const todayKey = dateKey(new Date());
  const weekDays = useMemo(() => {
    const start = startOfWeekMonday(cursor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const monthDays = useMemo(
    () => getMonthGridDays(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  const periodTitle = useMemo(() => {
    if (view === 'day') {
      return cursor.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    if (view === 'week') {
      const first = weekDays[0];
      const last = weekDays[6];
      const sameMonth = first.getMonth() === last.getMonth();
      return sameMonth
        ? `${first.getDate()} – ${last.getDate()} ${MONTHS_ID[first.getMonth()]} ${first.getFullYear()}`
        : `${first.getDate()} ${MONTHS_ID[first.getMonth()].slice(0, 3)} – ${last.getDate()} ${MONTHS_ID[last.getMonth()].slice(0, 3)} ${last.getFullYear()}`;
    }
    if (view === 'year') return String(cursor.getFullYear());
    return `${MONTHS_ID[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }, [view, cursor, weekDays]);

  const scheduleGroups = useMemo(() => {
    const groups: Array<{
      key: string;
      date: Date;
      events: Array<CalItem & { _start: Date; _end: Date }>;
    }> = [];
    const byKey = new Map<
      string,
      { key: string; date: Date; events: Array<CalItem & { _start: Date; _end: Date }> }
    >();
    for (const ev of projectedItems) {
      const k = dateKey(ev._start);
      let grp = byKey.get(k);
      if (!grp) {
        grp = {
          key: k,
          date: new Date(ev._start.getFullYear(), ev._start.getMonth(), ev._start.getDate()),
          events: [],
        };
        byKey.set(k, grp);
        groups.push(grp);
      }
      grp.events.push(ev);
    }
    return groups;
  }, [projectedItems]);

  const hasActiveSidebarFilter = Boolean(categoryFilter || divisionFilter);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
      {/* Sidebar Kiri Penuh: Create Agenda + Filter Kategori & Divisi */}
      <aside className="glass-sidebar flex w-full shrink-0 flex-col justify-between p-4 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-[272px] lg:overflow-y-auto lg:px-4 lg:py-6">
        <div className="space-y-5">
          {/* Tombol Create Agenda di Paling Atas */}
          {canManage && (
            <button
              type="button"
              onClick={() => openAddForDate(cursor)}
              className="btn-brand flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-md transition hover:brightness-105"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              Create Agenda
            </button>
          )}

          {/* Semua Agenda */}
          <div>
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('');
                setDivisionFilter('');
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                !hasActiveSidebarFilter
                  ? 'bg-brand-gradient text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.5)]'
                  : 'text-slate-700 hover:bg-white/75 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <CalendarDays className="h-4 w-4" />
                Semua Agenda
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  !hasActiveSidebarFilter ? 'bg-white/20 text-white' : 'bg-white/80 text-slate-600'
                }`}
              >
                {items.length}
              </span>
            </button>
          </div>

          {/* Filter Kategori */}
          <div className="space-y-1.5 border-t border-white/60 pt-4">
            <p className="flex items-center gap-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              <Tag className="h-3.5 w-3.5 text-emerald-600" />
              Kategori
            </p>
            <div className="space-y-1">
              {(
                Object.entries(CATEGORY_STYLE) as Array<
                  [CalItem['category'], (typeof CATEGORY_STYLE)[CalItem['category']]]
                >
              ).map(([catKey, st]) => {
                const active = categoryFilter === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setCategoryFilter(active ? '' : catKey)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                      active
                        ? 'glass-tile font-semibold text-violet-900 ring-1 ring-violet-300/80'
                        : 'text-slate-700 hover:bg-white/65 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} />
                      <span>{st.label}</span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        active
                          ? 'bg-brand-gradient-soft text-violet-800'
                          : 'bg-white/70 text-slate-600'
                      }`}
                    >
                      {categoryCounts[catKey] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter Divisi */}
          <div className="space-y-1.5 border-t border-white/60 pt-4">
            <p className="flex items-center gap-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              <Building2 className="h-3.5 w-3.5 text-violet-600" />
              Divisi
            </p>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() =>
                  setDivisionFilter(divisionFilter === '__GENERAL__' ? '' : '__GENERAL__')
                }
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  divisionFilter === '__GENERAL__'
                    ? 'glass-tile font-semibold text-violet-900 ring-1 ring-violet-300/80'
                    : 'text-slate-700 hover:bg-white/65 hover:text-slate-900'
                }`}
              >
                <span className="truncate">Umum / Lab EISD</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    divisionFilter === '__GENERAL__'
                      ? 'bg-brand-gradient-soft text-violet-800'
                      : 'bg-white/70 text-slate-600'
                  }`}
                >
                  {divisionCounts.__GENERAL__ ?? 0}
                </span>
              </button>
              {divisions.map((d) => {
                const active = divisionFilter === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDivisionFilter(active ? '' : d.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                      active
                        ? 'glass-tile font-semibold text-violet-900 ring-1 ring-violet-300/80'
                        : 'text-slate-700 hover:bg-white/65 hover:text-slate-900'
                    }`}
                  >
                    <span className="truncate">{d.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        active
                          ? 'bg-brand-gradient-soft text-violet-800'
                          : 'bg-white/70 text-slate-600'
                      }`}
                    >
                      {divisionCounts[d.id] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Reset Filter di Bawah Sidebar */}
        {hasActiveSidebarFilter && (
          <div className="mt-5 border-t border-white/60 pt-4">
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('');
                setDivisionFilter('');
              }}
              className="glass-tile flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-violet-800 transition hover:bg-white/95"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset Filter
            </button>
          </div>
        )}
      </aside>

      {/* Area Konten Utama Kalender */}
      <div className="min-w-0 flex-1 space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        {/* Toolbar Utama Kalender */}
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            {/* Kiri: Hari Ini + Navigasi + Judul Periode */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCursor(new Date())}
                className="glass-tile rounded-xl px-3.5 py-1.5 text-xs font-semibold text-violet-800 transition hover:bg-white/95"
              >
                Hari Ini
              </button>
              <div className="glass-tile inline-flex items-center rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => shiftPeriod(-1)}
                  className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white/90 hover:text-violet-700"
                  title="Sebelumnya"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => shiftPeriod(1)}
                  className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white/90 hover:text-violet-700"
                  title="Berikutnya"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                {periodTitle}
              </h1>
            </div>

            {/* Kanan: 5 Format View + Export iCal */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="glass-tile inline-flex rounded-xl p-1 text-xs font-medium">
                {VIEW_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setView(t.id)}
                    className={`rounded-lg px-2.5 py-1.5 transition ${
                      view === t.id
                        ? 'bg-brand-gradient font-semibold text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <a
                href="/api/calendar?format=ics"
                className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white/95"
                title="Export iCal (.ics)"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden sm:inline">iCal</span>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* ==================== 1. MONTH VIEW ==================== */}
        {view === 'month' && (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 border-b border-white/70 bg-white/40 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
              {WEEKDAYS_SHORT.map((day) => (
                <div key={day} className="py-3">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-white/60">
              {monthDays.map((day) => {
                const k = dateKey(day);
                const inMonth = day.getMonth() === cursor.getMonth();
                const isToday = k === todayKey;
                const dayEvents = eventsByDay.get(k) ?? [];
                return (
                  <div
                    key={k}
                    className={`group min-h-[112px] p-2 transition ${
                      inMonth ? 'bg-white/30 hover:bg-white/55' : 'bg-slate-100/35 text-slate-400'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setCursor(day);
                          setView('day');
                        }}
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${
                          isToday
                            ? 'bg-brand-gradient text-white shadow-sm'
                            : inMonth
                              ? 'text-slate-800 hover:bg-violet-100/80 hover:text-violet-800'
                              : 'text-slate-400 hover:bg-white/70'
                        }`}
                      >
                        {day.getDate()}
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => openAddForDate(day)}
                          className="rounded-md p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-white/80 hover:text-violet-700"
                          title="Tambah agenda pada tanggal ini"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((ev) => {
                        const st = CATEGORY_STYLE[ev.category] ?? CATEGORY_STYLE.OTHER;
                        return (
                          <button
                            key={`${ev.id}-${k}`}
                            type="button"
                            onClick={() => setSelectedEvent(ev)}
                            className={`flex w-full items-center gap-1.5 truncate rounded-lg border px-1.5 py-0.5 text-left text-[11px] font-medium transition hover:brightness-95 ${st.pill}`}
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
                            <span className="truncate">{ev.title}</span>
                          </button>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <button
                          type="button"
                          onClick={() => {
                            setCursor(day);
                            setView('day');
                          }}
                          className="w-full px-1.5 text-left text-[10.5px] font-semibold text-violet-700 hover:underline"
                        >
                          +{dayEvents.length - 3} agenda lainnya
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ==================== 2. WEEK VIEW ==================== */}
        {view === 'week' && (
          <Card className="overflow-x-auto">
            <div className="min-w-[780px]">
              {/* Header Hari */}
              <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-white/70 bg-white/45">
                <div className="p-2 text-center text-[10px] font-semibold text-slate-400">WIB</div>
                {weekDays.map((d, idx) => {
                  const k = dateKey(d);
                  const isToday = k === todayKey;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setCursor(d);
                        setView('day');
                      }}
                      className="flex flex-col items-center py-2.5 transition hover:bg-white/60"
                    >
                      <span className="text-[11px] font-semibold uppercase text-slate-500">
                        {WEEKDAYS_SHORT[idx]}
                      </span>
                      <span
                        className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                          isToday ? 'bg-brand-gradient text-white shadow-sm' : 'text-slate-900'
                        }`}
                      >
                        {d.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Baris Sepanjang Hari */}
              <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-white/70 bg-white/25">
                <div className="p-2 text-right text-[10px] font-semibold text-slate-400">
                  All-day
                </div>
                {weekDays.map((d) => {
                  const k = dateKey(d);
                  const allDayEvents = (eventsByDay.get(k) ?? []).filter((e) => e.allDay);
                  return (
                    <div key={k} className="min-h-[38px] space-y-1 border-l border-white/60 p-1">
                      {allDayEvents.map((ev) => {
                        const st = CATEGORY_STYLE[ev.category] ?? CATEGORY_STYLE.OTHER;
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => setSelectedEvent(ev)}
                            className={`block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[10.5px] font-medium ${st.pill}`}
                          >
                            {ev.title}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Grid Jam 06:00 - 22:00 */}
              <div className="max-h-[560px] overflow-y-auto">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-white/50"
                  >
                    <div className="py-3 pr-2 text-right text-[11px] font-medium text-slate-400">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                    {weekDays.map((d) => {
                      const k = dateKey(d);
                      const slotEvents = (eventsByDay.get(k) ?? []).filter(
                        (ev) => !ev.allDay && ev._start.getHours() === hour,
                      );
                      return (
                        <div
                          key={k}
                          className="min-h-[52px] space-y-1 border-l border-white/50 p-1 hover:bg-white/40"
                        >
                          {slotEvents.map((ev) => {
                            const st = CATEGORY_STYLE[ev.category] ?? CATEGORY_STYLE.OTHER;
                            return (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={() => setSelectedEvent(ev)}
                                className={`block w-full rounded-lg border border-l-4 px-2 py-1 text-left text-[11px] font-semibold shadow-sm ${st.pill} ${st.border}`}
                              >
                                <p className="truncate">{ev.title}</p>
                                <p className="text-[10px] font-normal opacity-80">
                                  {formatTimeWib(ev.startAt)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* ==================== 3. DAY VIEW ==================== */}
        {view === 'day' &&
          (() => {
            const k = dateKey(cursor);
            const dayEvents = eventsByDay.get(k) ?? [];
            const allDayEvents = dayEvents.filter((e) => e.allDay);
            const timedEvents = dayEvents.filter((e) => !e.allDay);

            return (
              <div className="grid gap-5 lg:grid-cols-12">
                <Card className="overflow-hidden lg:col-span-8">
                  {allDayEvents.length > 0 && (
                    <div className="border-b border-white/70 bg-white/40 p-3">
                      <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                        Sepanjang Hari
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {allDayEvents.map((ev) => {
                          const st = CATEGORY_STYLE[ev.category] ?? CATEGORY_STYLE.OTHER;
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => setSelectedEvent(ev)}
                              className={`rounded-xl border px-3 py-1 text-xs font-semibold ${st.pill}`}
                            >
                              {ev.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="max-h-[580px] overflow-y-auto divide-y divide-white/50">
                    {HOURS.map((hour) => {
                      const slot = timedEvents.filter((ev) => ev._start.getHours() === hour);
                      return (
                        <div key={hour} className="flex min-h-[56px] items-stretch">
                          <div className="w-16 shrink-0 border-r border-white/60 py-3 pr-3 text-right text-xs font-medium text-slate-400">
                            {String(hour).padStart(2, '0')}:00
                          </div>
                          <div className="flex-1 space-y-1.5 p-2 hover:bg-white/35">
                            {slot.map((ev) => {
                              const st = CATEGORY_STYLE[ev.category] ?? CATEGORY_STYLE.OTHER;
                              return (
                                <button
                                  key={ev.id}
                                  type="button"
                                  onClick={() => setSelectedEvent(ev)}
                                  className={`flex w-full items-center justify-between gap-2 rounded-xl border border-l-4 px-3 py-2 text-left text-xs shadow-sm ${st.pill} ${st.border}`}
                                >
                                  <div>
                                    <p className="font-semibold">{ev.title}</p>
                                    <p className="mt-0.5 text-[11px] opacity-80">
                                      {formatTimeWib(ev.startAt)} – {formatTimeWib(ev.endAt)} WIB
                                      {ev.location ? ` · ${ev.location}` : ''}
                                    </p>
                                  </div>
                                  <Badge variant="secondary">{ev.divisionName || st.label}</Badge>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <Card className="lg:col-span-4">
                  <CardContent className="space-y-3 p-5">
                    <h2 className="text-sm font-bold text-slate-900">
                      Ringkasan Hari Ini ({dayEvents.length})
                    </h2>
                    {dayEvents.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Tidak ada agenda terjadwal pada tanggal ini.
                      </p>
                    ) : (
                      dayEvents.map((ev) => {
                        const st = CATEGORY_STYLE[ev.category] ?? CATEGORY_STYLE.OTHER;
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => setSelectedEvent(ev)}
                            className="glass-tile block w-full rounded-xl p-3 text-left transition hover:bg-white/95"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900">
                                {ev.title}
                              </span>
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} />
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {ev.allDay
                                ? 'Sepanjang hari'
                                : `${formatTimeWib(ev.startAt)} – ${formatTimeWib(ev.endAt)} WIB`}
                              {ev.location ? ` · ${ev.location}` : ''}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })()}

        {/* ==================== 4. YEAR VIEW ==================== */}
        {view === 'year' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {MONTHS_ID.map((monthName, monthIdx) => {
              const days = getMonthGridDays(cursor.getFullYear(), monthIdx);
              return (
                <Card key={monthName}>
                  <CardContent className="p-4">
                    <button
                      type="button"
                      onClick={() => {
                        setCursor(new Date(cursor.getFullYear(), monthIdx, 1));
                        setView('month');
                      }}
                      className="mb-2.5 flex w-full items-center justify-between text-left text-sm font-bold text-slate-900 hover:text-violet-700"
                    >
                      <span>{monthName}</span>
                      <span className="text-[11px] font-medium text-violet-600">Buka →</span>
                    </button>
                    <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold text-slate-400">
                      {WEEKDAYS_SHORT.map((w) => (
                        <span key={w}>{w.slice(0, 1)}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-1 text-center text-[11px]">
                      {days.map((d) => {
                        const k = dateKey(d);
                        const inM = d.getMonth() === monthIdx;
                        const isToday = k === todayKey;
                        const evs = eventsByDay.get(k) ?? [];
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => {
                              setCursor(d);
                              setView('day');
                            }}
                            title={
                              evs.length > 0
                                ? `${evs.length} agenda: ${evs.map((e) => e.title).join(', ')}`
                                : undefined
                            }
                            className={`relative mx-auto flex h-7 w-7 flex-col items-center justify-center rounded-full transition ${
                              isToday
                                ? 'bg-brand-gradient font-bold text-white shadow-sm'
                                : inM
                                  ? evs.length > 0
                                    ? 'bg-violet-100/80 font-semibold text-violet-900 hover:bg-violet-200'
                                    : 'text-slate-700 hover:bg-white/80'
                                  : 'text-slate-300'
                            }`}
                          >
                            <span>{d.getDate()}</span>
                            {evs.length > 0 && !isToday && (
                              <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-emerald-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ==================== 5. SCHEDULE VIEW ==================== */}
        {view === 'schedule' && (
          <Card>
            <CardContent className="divide-y divide-white/60 p-5">
              {scheduleGroups.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Belum ada agenda yang tercatat untuk filter saat ini.
                </p>
              ) : (
                scheduleGroups.map((grp) => {
                  const isToday = grp.key === todayKey;
                  return (
                    <div
                      key={grp.key}
                      className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCursor(grp.date);
                          setView('day');
                        }}
                        className="flex w-36 shrink-0 items-center gap-3 text-left"
                      >
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-bold ${
                            isToday
                              ? 'bg-brand-gradient text-white shadow-sm'
                              : 'glass-tile text-slate-900'
                          }`}
                        >
                          {grp.date.getDate()}
                        </span>
                        <div className="leading-tight">
                          <p className="text-xs font-bold text-slate-900">
                            {MONTHS_ID[grp.date.getMonth()].slice(0, 3)} {grp.date.getFullYear()}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {grp.date.toLocaleDateString('id-ID', { weekday: 'long' })}
                          </p>
                        </div>
                      </button>

                      <div className="flex-1 space-y-2">
                        {grp.events.map((ev) => {
                          const st = CATEGORY_STYLE[ev.category] ?? CATEGORY_STYLE.OTHER;
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => setSelectedEvent(ev)}
                              className={`glass-tile flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border-l-4 px-4 py-3 text-left transition hover:bg-white/95 ${st.border}`}
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{ev.title}</p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-violet-600" />
                                    {ev.allDay
                                      ? 'Sepanjang hari'
                                      : `${formatTimeWib(ev.startAt)} – ${formatTimeWib(ev.endAt)} WIB`}
                                  </span>
                                  {ev.location && (
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin className="h-3 w-3 text-emerald-600" />
                                      {ev.location}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <Badge variant="secondary" className={st.pill}>
                                ● {ev.divisionName || st.label}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        {/* Modal Detail Agenda saat Event Diklik */}
        {selectedEvent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm"
            onClick={() => setSelectedEvent(null)}
          >
            <div
              className="glass-panel w-full max-w-md overflow-hidden rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1.5 w-full bg-brand-gradient" />
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge
                      variant="secondary"
                      className={
                        (CATEGORY_STYLE[selectedEvent.category] ?? CATEGORY_STYLE.OTHER).pill
                      }
                    >
                      ● {(CATEGORY_STYLE[selectedEvent.category] ?? CATEGORY_STYLE.OTHER).label}
                    </Badge>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">{selectedEvent.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-white/80 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2 text-xs text-slate-700">
                  <p className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    <span>Divisi: {selectedEvent.divisionName || 'Umum / Seluruh Lab EISD'}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-violet-600" />
                    <span>
                      Mulai:{' '}
                      {new Date(selectedEvent.startAt).toLocaleDateString('id-ID', {
                        dateStyle: 'full',
                        timeZone: 'Asia/Jakarta',
                      })}
                      {!selectedEvent.allDay
                        ? ` · ${formatTimeWib(selectedEvent.startAt)} WIB`
                        : ''}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    <span>
                      {selectedEvent.allDay
                        ? 'Sepanjang hari'
                        : `Selesai: ${new Date(selectedEvent.endAt).toLocaleDateString('id-ID', {
                            dateStyle: 'full',
                            timeZone: 'Asia/Jakarta',
                          })} · ${formatTimeWib(selectedEvent.endAt)} WIB`}
                    </span>
                  </p>
                  {selectedEvent.location && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-violet-600" />
                      <span>{selectedEvent.location}</span>
                    </p>
                  )}
                </div>

                {selectedEvent.description && (
                  <div className="glass-tile rounded-xl p-3 text-xs text-slate-600">
                    {selectedEvent.description}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-white/60 pt-3 text-[11px] text-slate-500">
                  <span>Sumber: {selectedEvent.sourceModule || 'calendar'}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(null)}
                    className="btn-brand rounded-xl px-4 py-1.5 text-xs font-semibold"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Popup Modal Tengah Layar: Tambah Kegiatan Baru */}
        {showAdd &&
          canManage &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-md"
              onClick={() => {
                if (!saving) setShowAdd(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-agenda-title"
                className="glass-panel max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/80 bg-white/90 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-1.5 w-full bg-brand-gradient" />
                <div className="p-6">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-sm">
                        <CalendarDays className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 id="create-agenda-title" className="text-base font-bold text-slate-900">
                          Create Agenda Baru
                        </h2>
                        <p className="text-xs text-slate-500">
                          Jadwalkan kegiatan laboratorium ke kalender EISD.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!saving) setShowAdd(false);
                      }}
                      className="rounded-xl p-1.5 text-slate-400 transition hover:bg-white/80 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {formError && (
                    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/90 px-3.5 py-2 text-xs text-rose-700">
                      {formError}
                    </div>
                  )}

                  <form onSubmit={(e) => void handleAdd(e)} className="space-y-4">
                    <FieldGroup label="Judul Kegiatan" required>
                      <input
                        required
                        autoFocus
                        placeholder="Mis. Rapat Koordinasi Bulanan / Workshop EISD"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm"
                      />
                    </FieldGroup>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <FieldGroup label="Divisi" required>
                        <GlassSelect
                          value={form.divisionId}
                          onChange={(v) => setForm({ ...form, divisionId: v })}
                          placeholder="Pilih Divisi"
                          options={[
                            { value: '', label: 'Umum / Seluruh Lab EISD' },
                            ...selectableDivisions.map((d) => ({ value: d.id, label: d.name })),
                          ]}
                        />
                      </FieldGroup>

                      <FieldGroup label="Kategori" required>
                        <GlassSelect
                          value={form.category}
                          onChange={(v) => setForm({ ...form, category: v as CalItem['category'] })}
                          placeholder="Pilih Kategori"
                          options={[
                            { value: 'MEETING', label: 'Rapat' },
                            { value: 'EVENT', label: 'Event' },
                            { value: 'PRAKTIKUM', label: 'Praktikum' },
                            { value: 'COMPETITION', label: 'Lomba' },
                            { value: 'BIRTHDAY', label: 'Ulang Tahun' },
                            { value: 'OTHER', label: 'Lainnya' },
                          ]}
                        />
                      </FieldGroup>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <FieldGroup label="Tanggal & Jam Mulai" required>
                        <div className="grid grid-cols-[1fr_104px] gap-2">
                          <input
                            type="date"
                            required
                            value={form.startDate}
                            onChange={(e) => {
                              const nextStart = e.target.value;
                              setForm((prev) => ({
                                ...prev,
                                startDate: nextStart,
                                endDate: prev.endDate < nextStart ? nextStart : prev.endDate,
                              }));
                            }}
                            className="w-full px-3 py-2 text-sm"
                          />
                          <input
                            type="time"
                            required
                            value={form.startTime}
                            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                            className="w-full px-2.5 py-2 text-sm"
                          />
                        </div>
                      </FieldGroup>

                      <FieldGroup label="Tanggal & Jam Selesai" required>
                        <div className="grid grid-cols-[1fr_104px] gap-2">
                          <input
                            type="date"
                            required
                            min={form.startDate}
                            value={form.endDate}
                            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                            className="w-full px-3 py-2 text-sm"
                          />
                          <input
                            type="time"
                            required
                            value={form.endTime}
                            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                            className="w-full px-2.5 py-2 text-sm"
                          />
                        </div>
                      </FieldGroup>
                    </div>

                    <FieldGroup label="Lokasi" required>
                      <input
                        required
                        placeholder="Mis. Ruang Lab EISD / Auditorium / Zoom"
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm"
                      />
                    </FieldGroup>

                    <FieldGroup label="Keterangan (Opsional)">
                      <textarea
                        rows={2}
                        placeholder="Catatan tambahan kegiatan (opsional)"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="w-full px-3.5 py-2 text-sm"
                      />
                    </FieldGroup>

                    <div className="flex items-center justify-end gap-2.5 border-t border-white/70 pt-4">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setShowAdd(false)}
                        className="glass-tile rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white/95"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="btn-brand rounded-xl px-5 py-2 text-xs font-semibold disabled:opacity-50"
                      >
                        {saving ? 'Menyimpan...' : 'Simpan Kegiatan'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
