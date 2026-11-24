'use client';

import { useMemo, useState } from 'react';
import { BarChart3, PieChart, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

export interface FinanceMonthlyPoint {
  month: number;
  label: string;
  fullLabel: string;
  income: number;
  expense: number;
  net: number;
  cumulativeBalance: number;
  kasPaidCount: number;
  kasTargetCount: number;
  kasCollected: number;
  kasTarget: number;
}

export interface FinanceCategorySlice {
  category: string;
  total: number;
  count: number;
}

export interface FinanceAnalyticsData {
  year: number;
  yearIncome: number;
  yearExpense: number;
  yearNet: number;
  openingBalanceBeforeYear: number;
  monthly: FinanceMonthlyPoint[];
  incomeByCategory: FinanceCategorySlice[];
  expenseByCategory: FinanceCategorySlice[];
}

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function compactRp(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `${sign}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} jt`;
  }
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} rb`;
  return `${sign}${abs}`;
}

const DONUT_COLORS = [
  '#7c3aed',
  '#10b981',
  '#f43f5e',
  '#0ea5e9',
  '#f59e0b',
  '#6366f1',
  '#14b8a6',
  '#ec4899',
];

export function FinanceAnalyticsCharts({
  analytics,
  monthlyFee,
}: {
  analytics: FinanceAnalyticsData;
  monthlyFee: number;
}) {
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);
  const [hoveredLineIdx, setHoveredLineIdx] = useState<number | null>(null);
  const [hoveredKasIdx, setHoveredKasIdx] = useState<number | null>(null);
  const [donutMode, setDonutMode] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [hoveredSliceIdx, setHoveredSliceIdx] = useState<number | null>(null);

  // 1. Grouped Bar Chart metrics (Income vs Expense)
  const barMax = useMemo(() => {
    const m = Math.max(100_000, ...analytics.monthly.map((p) => Math.max(p.income, p.expense)));
    // Round up cleanly
    const magnitude = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / magnitude) * magnitude;
  }, [analytics.monthly]);

  const activeBarPoint = hoveredBarIdx !== null ? analytics.monthly[hoveredBarIdx] : null;

  // 2. Donut Chart metrics
  const activeCategories =
    donutMode === 'EXPENSE' ? analytics.expenseByCategory : analytics.incomeByCategory;
  const donutTotal = useMemo(
    () => activeCategories.reduce((acc, c) => acc + c.total, 0),
    [activeCategories],
  );
  const donutSegments = useMemo(() => {
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    return activeCategories.slice(0, 8).map((c, idx) => {
      const ratio = donutTotal > 0 ? c.total / donutTotal : 0;
      const length = ratio * circumference;
      const seg = {
        ...c,
        ratio,
        percent: Math.round(ratio * 1000) / 10,
        color: DONUT_COLORS[idx % DONUT_COLORS.length],
        dasharray: `${Math.max(0, length - 1.5)} ${circumference}`,
        dashoffset: -offset,
      };
      offset += length;
      return seg;
    });
  }, [activeCategories, donutTotal]);

  const hoveredSlice = hoveredSliceIdx !== null ? (donutSegments[hoveredSliceIdx] ?? null) : null;

  // 3. Cumulative Balance Line/Area Chart metrics
  const lineBounds = useMemo(() => {
    const vals = analytics.monthly.map((p) => p.cumulativeBalance);
    const rawMin = Math.min(0, ...vals);
    const rawMax = Math.max(100_000, ...vals);
    const span = Math.max(100_000, rawMax - rawMin);
    return {
      min: rawMin,
      max: rawMax + span * 0.1,
    };
  }, [analytics.monthly]);

  const lineSvg = useMemo(() => {
    const padLeft = 58;
    const padRight = 18;
    const padTop = 20;
    const padBottom = 34;
    const width = 560;
    const height = 220;
    const innerW = width - padLeft - padRight;
    const innerH = height - padTop - padBottom;
    const range = Math.max(1, lineBounds.max - lineBounds.min);

    const pts = analytics.monthly.map((p, idx) => {
      const x = padLeft + (idx / 11) * innerW;
      const y = padTop + innerH - ((p.cumulativeBalance - lineBounds.min) / range) * innerH;
      return { x, y, point: p };
    });

    const linePath = pts
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(' ');
    const areaPath =
      pts.length > 0
        ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`
        : '';

    return {
      padLeft,
      padRight,
      padTop,
      padBottom,
      width,
      height,
      innerW,
      innerH,
      pts,
      linePath,
      areaPath,
    };
  }, [analytics.monthly, lineBounds]);

  const activeLinePoint = hoveredLineIdx !== null ? analytics.monthly[hoveredLineIdx] : null;
  const activeKasPoint = hoveredKasIdx !== null ? analytics.monthly[hoveredKasIdx] : null;

  return (
    <div className="space-y-5">
      {/* Row 1: Grouped Bar Chart (7 cols) + Category Donut (5 cols) */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-col gap-2 border-b border-white/60 pb-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-violet-600">
                <BarChart3 className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base">
                  Pemasukan vs Pengeluaran ({analytics.year})
                </CardTitle>
                <p className="text-[11px] text-slate-500">
                  Arahkan kursor ke bulan untuk detail arus kas bulanan.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Pemasukan
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-700">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Pengeluaran
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Interactive hover detail bar */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/70 bg-white/65 px-3.5 py-2 text-xs backdrop-blur-sm">
              {activeBarPoint ? (
                <>
                  <span className="font-semibold text-slate-900">
                    {activeBarPoint.fullLabel} {analytics.year}
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-emerald-700">
                      Masuk: {rp(activeBarPoint.income)}
                    </span>
                    <span className="font-semibold text-rose-700">
                      Keluar: {rp(activeBarPoint.expense)}
                    </span>
                    <span
                      className={`font-semibold ${
                        activeBarPoint.net >= 0 ? 'text-violet-700' : 'text-rose-700'
                      }`}
                    >
                      Selisih: {activeBarPoint.net >= 0 ? '+' : ''}
                      {rp(activeBarPoint.net)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <span className="font-semibold text-slate-700">Total Tahun {analytics.year}</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-emerald-700">
                      Masuk: {rp(analytics.yearIncome)}
                    </span>
                    <span className="font-semibold text-rose-700">
                      Keluar: {rp(analytics.yearExpense)}
                    </span>
                    <span
                      className={`font-semibold ${
                        analytics.yearNet >= 0 ? 'text-violet-700' : 'text-rose-700'
                      }`}
                    >
                      Neto: {analytics.yearNet >= 0 ? '+' : ''}
                      {rp(analytics.yearNet)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="w-full overflow-x-auto">
              <svg
                viewBox="0 0 680 245"
                className="h-auto w-full min-w-[480px] select-none"
                role="img"
                aria-label={`Grafik pemasukan dan pengeluaran bulanan ${analytics.year}`}
              >
                <defs>
                  <linearGradient id="finIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="finExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" />
                    <stop offset="100%" stopColor="#e11d48" />
                  </linearGradient>
                </defs>

                {/* Horizontal Gridlines & Y Labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                  const y = 205 - t * 180;
                  const val = barMax * t;
                  return (
                    <g key={t}>
                      <line
                        x1={56}
                        y1={y}
                        x2={668}
                        y2={y}
                        stroke="rgba(148,163,184,0.28)"
                        strokeDasharray={t === 0 ? undefined : '4 4'}
                      />
                      <text
                        x={50}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-slate-500 text-[10px] font-medium"
                      >
                        {compactRp(val)}
                      </text>
                    </g>
                  );
                })}

                {/* 12 Months Grouped Bars */}
                {analytics.monthly.map((pt, idx) => {
                  const colW = 612 / 12;
                  const colX = 56 + idx * colW;
                  const incH = Math.max(pt.income > 0 ? 4 : 0, (pt.income / barMax) * 180);
                  const expH = Math.max(pt.expense > 0 ? 4 : 0, (pt.expense / barMax) * 180);
                  const isHovered = hoveredBarIdx === idx;
                  const barW = 14;
                  const incX = colX + colW / 2 - barW - 2;
                  const expX = colX + colW / 2 + 2;

                  return (
                    <g
                      key={pt.month}
                      onMouseEnter={() => setHoveredBarIdx(idx)}
                      onMouseLeave={() => setHoveredBarIdx(null)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={colX + 2}
                        y={18}
                        width={colW - 4}
                        height={210}
                        rx={10}
                        fill={isHovered ? 'rgba(139,92,246,0.09)' : 'transparent'}
                      />
                      <rect
                        x={incX}
                        y={205 - incH}
                        width={barW}
                        height={incH}
                        rx={5}
                        fill="url(#finIncomeGrad)"
                        opacity={hoveredBarIdx === null || isHovered ? 1 : 0.45}
                      />
                      <rect
                        x={expX}
                        y={205 - expH}
                        width={barW}
                        height={expH}
                        rx={5}
                        fill="url(#finExpenseGrad)"
                        opacity={hoveredBarIdx === null || isHovered ? 1 : 0.45}
                      />
                      <text
                        x={colX + colW / 2}
                        y={224}
                        textAnchor="middle"
                        className={`text-[10px] ${
                          isHovered ? 'fill-violet-700 font-bold' : 'fill-slate-600 font-medium'
                        }`}
                      >
                        {pt.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </CardContent>
        </Card>

        {/* Donut Chart: Category Breakdown */}
        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-white/60 pb-3.5">
            <div className="flex items-center gap-2">
              <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-emerald-600">
                <PieChart className="h-4 w-4" />
              </span>
              <CardTitle className="text-base">Proporsi Kategori</CardTitle>
            </div>
            <div className="glass-tile inline-flex rounded-xl p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  setDonutMode('EXPENSE');
                  setHoveredSliceIdx(null);
                }}
                className={`rounded-lg px-2.5 py-1 transition ${
                  donutMode === 'EXPENSE'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => {
                  setDonutMode('INCOME');
                  setHoveredSliceIdx(null);
                }}
                className={`rounded-lg px-2.5 py-1 transition ${
                  donutMode === 'INCOME'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pemasukan
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {donutSegments.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-xs text-slate-500">
                Belum ada transaksi {donutMode === 'EXPENSE' ? 'pengeluaran' : 'pemasukan'} di tahun{' '}
                {analytics.year}.
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative h-44 w-44 shrink-0">
                  <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
                    <circle
                      cx={80}
                      cy={80}
                      r={58}
                      fill="none"
                      stroke="rgba(226,232,240,0.65)"
                      strokeWidth={20}
                    />
                    {donutSegments.map((seg, idx) => (
                      <circle
                        key={seg.category}
                        cx={80}
                        cy={80}
                        r={58}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={hoveredSliceIdx === idx ? 24 : 20}
                        strokeDasharray={seg.dasharray}
                        strokeDashoffset={seg.dashoffset}
                        strokeLinecap="butt"
                        onMouseEnter={() => setHoveredSliceIdx(idx)}
                        onMouseLeave={() => setHoveredSliceIdx(null)}
                        className="cursor-pointer transition-all duration-150"
                        opacity={hoveredSliceIdx === null || hoveredSliceIdx === idx ? 1 : 0.4}
                      />
                    ))}
                  </svg>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                    <span className="text-[10px] font-medium text-slate-500">
                      {hoveredSlice
                        ? hoveredSlice.category
                        : donutMode === 'EXPENSE'
                          ? 'Total Keluar'
                          : 'Total Masuk'}
                    </span>
                    <span className="mt-0.5 text-xs font-bold text-slate-900">
                      {compactRp(hoveredSlice ? hoveredSlice.total : donutTotal)}
                    </span>
                    {hoveredSlice && (
                      <span className="text-[10px] font-semibold text-violet-600">
                        {hoveredSlice.percent}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-full flex-1 space-y-2 text-xs">
                  {donutSegments.map((seg, idx) => (
                    <div
                      key={seg.category}
                      onMouseEnter={() => setHoveredSliceIdx(idx)}
                      onMouseLeave={() => setHoveredSliceIdx(null)}
                      className={`cursor-pointer rounded-xl px-2.5 py-1.5 transition ${
                        hoveredSliceIdx === idx ? 'bg-white/85 shadow-sm' : 'hover:bg-white/55'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: seg.color }}
                          />
                          <span className="truncate">{seg.category}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-slate-900">
                          {seg.percent}%
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between pl-4 text-[11px] text-slate-500">
                        <span>{seg.count} transaksi</span>
                        <span className="font-medium text-slate-700">{rp(seg.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Cumulative Balance Area Chart (6 cols) + Kas Bulanan Compliance Chart (6 cols) */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-6">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-white/60 pb-3.5">
            <div className="flex items-center gap-2">
              <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-violet-600">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base">Tren Saldo Kumulatif ({analytics.year})</CardTitle>
                <p className="text-[11px] text-slate-500">
                  Perkembangan saldo akhir kas setiap bulan.
                </p>
              </div>
            </div>
            <span className="rounded-xl border border-white/70 bg-white/70 px-2.5 py-1 text-xs font-semibold text-violet-800">
              {activeLinePoint
                ? `${activeLinePoint.label}: ${rp(activeLinePoint.cumulativeBalance)}`
                : `Akhir Tahun: ${rp(analytics.monthly[11]?.cumulativeBalance ?? 0)}`}
            </span>
          </CardHeader>
          <CardContent className="pt-4">
            <svg
              viewBox={`0 0 ${lineSvg.width} ${lineSvg.height}`}
              className="h-auto w-full select-none"
              role="img"
              aria-label={`Tren saldo kumulatif ${analytics.year}`}
            >
              <defs>
                <linearGradient id="finLineStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
                <linearGradient id="finAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {[0, 0.5, 1].map((t) => {
                const y = lineSvg.padTop + lineSvg.innerH - t * lineSvg.innerH;
                const val = lineBounds.min + (lineBounds.max - lineBounds.min) * t;
                return (
                  <g key={t}>
                    <line
                      x1={lineSvg.padLeft}
                      y1={y}
                      x2={lineSvg.width - lineSvg.padRight}
                      y2={y}
                      stroke="rgba(148,163,184,0.28)"
                      strokeDasharray={t === 0 ? undefined : '4 4'}
                    />
                    <text
                      x={lineSvg.padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500 text-[10px] font-medium"
                    >
                      {compactRp(val)}
                    </text>
                  </g>
                );
              })}

              {lineSvg.areaPath && <path d={lineSvg.areaPath} fill="url(#finAreaFill)" />}
              {lineSvg.linePath && (
                <path
                  d={lineSvg.linePath}
                  fill="none"
                  stroke="url(#finLineStroke)"
                  strokeWidth={2.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {lineSvg.pts.map(({ x, y, point }, idx) => {
                const isHovered = hoveredLineIdx === idx;
                return (
                  <g
                    key={point.month}
                    onMouseEnter={() => setHoveredLineIdx(idx)}
                    onMouseLeave={() => setHoveredLineIdx(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={x - 18}
                      y={lineSvg.padTop}
                      width={36}
                      height={lineSvg.innerH + 24}
                      fill="transparent"
                    />
                    {isHovered && (
                      <line
                        x1={x}
                        y1={lineSvg.padTop}
                        x2={x}
                        y2={lineSvg.padTop + lineSvg.innerH}
                        stroke="rgba(124,58,237,0.35)"
                        strokeDasharray="3 3"
                      />
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 5.5 : 3.5}
                      fill={isHovered ? '#7c3aed' : '#ffffff'}
                      stroke="#7c3aed"
                      strokeWidth={2}
                    />
                    <text
                      x={x}
                      y={lineSvg.height - 10}
                      textAnchor="middle"
                      className={`text-[10px] ${
                        isHovered ? 'fill-violet-700 font-bold' : 'fill-slate-600 font-medium'
                      }`}
                    >
                      {point.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </CardContent>
        </Card>

        {/* Kas Bulanan Compliance Chart */}
        <Card className="lg:col-span-6">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-white/60 pb-3.5">
            <div className="flex items-center gap-2">
              <span className="glass-tile flex h-8 w-8 items-center justify-center rounded-xl text-emerald-600">
                <Users className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base">
                  Kepatuhan Kas Bulanan ({rp(monthlyFee)}/bln)
                </CardTitle>
                <p className="text-[11px] text-slate-500">
                  Persentase anggota aktif yang melunasi kas per bulan.
                </p>
              </div>
            </div>
            <span className="rounded-xl border border-white/70 bg-white/70 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {activeKasPoint
                ? `${activeKasPoint.label}: ${activeKasPoint.kasPaidCount}/${activeKasPoint.kasTargetCount} (${rp(activeKasPoint.kasCollected)})`
                : `Target/bln: ${rp(analytics.monthly[0]?.kasTarget ?? 0)}`}
            </span>
          </CardHeader>
          <CardContent className="pt-4">
            <svg
              viewBox="0 0 560 220"
              className="h-auto w-full select-none"
              role="img"
              aria-label={`Kepatuhan kas bulanan anggota ${analytics.year}`}
            >
              {[0, 25, 50, 75, 100].map((pct) => {
                const y = 184 - (pct / 100) * 160;
                return (
                  <g key={pct}>
                    <line
                      x1={42}
                      y1={y}
                      x2={546}
                      y2={y}
                      stroke="rgba(148,163,184,0.28)"
                      strokeDasharray={pct === 0 ? undefined : '4 4'}
                    />
                    <text
                      x={36}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500 text-[10px] font-medium"
                    >
                      {pct}%
                    </text>
                  </g>
                );
              })}

              {analytics.monthly.map((pt, idx) => {
                const colW = 504 / 12;
                const colX = 42 + idx * colW;
                const pct = pt.kasTargetCount > 0 ? (pt.kasPaidCount / pt.kasTargetCount) * 100 : 0;
                const barH = Math.max(pct > 0 ? 4 : 0, (pct / 100) * 160);
                const isHovered = hoveredKasIdx === idx;
                const fillColor =
                  pct >= 75 ? '#10b981' : pct >= 40 ? '#8b5cf6' : pct > 0 ? '#f59e0b' : '#cbd5e1';

                return (
                  <g
                    key={pt.month}
                    onMouseEnter={() => setHoveredKasIdx(idx)}
                    onMouseLeave={() => setHoveredKasIdx(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={colX + 3}
                      y={16}
                      width={colW - 6}
                      height={196}
                      rx={8}
                      fill={isHovered ? 'rgba(16,185,129,0.09)' : 'transparent'}
                    />
                    <rect
                      x={colX + colW / 2 - 11}
                      y={184 - barH}
                      width={22}
                      height={barH}
                      rx={6}
                      fill={fillColor}
                      opacity={hoveredKasIdx === null || isHovered ? 0.92 : 0.45}
                    />
                    {pct > 0 && (
                      <text
                        x={colX + colW / 2}
                        y={Math.max(18, 178 - barH)}
                        textAnchor="middle"
                        className="fill-slate-700 text-[9px] font-semibold"
                      >
                        {Math.round(pct)}%
                      </text>
                    )}
                    <text
                      x={colX + colW / 2}
                      y={204}
                      textAnchor="middle"
                      className={`text-[10px] ${
                        isHovered ? 'fill-emerald-700 font-bold' : 'fill-slate-600 font-medium'
                      }`}
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
