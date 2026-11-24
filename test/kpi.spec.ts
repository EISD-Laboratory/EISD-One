import { describe, expect, it } from 'vitest';
import { buildIcalFeed } from '@/core/calendar';
import { normalizeKpiValue, validateIndicatorWeights } from '@/core/kpi';

describe('KPI Engine & Calendar iCal', () => {
  it('menormalisasi nilai ke 0-100 dengan clamping', () => {
    expect(normalizeKpiValue(3, 1, 5)).toBe(50);
    expect(normalizeKpiValue(5, 1, 5)).toBe(100);
    expect(normalizeKpiValue(10, 0, 4)).toBe(100);
    expect(normalizeKpiValue(-5, 0, 4)).toBe(0);
  });

  it('memvalidasi total bobot KPI harus tepat 100%', () => {
    expect(validateIndicatorWeights([{ weight: 60, targetDivisionId: null }]).valid).toBe(false);
    expect(
      validateIndicatorWeights([
        { weight: 30, targetDivisionId: null },
        { weight: 30, targetDivisionId: null },
        { weight: 40, targetDivisionId: null },
      ]).valid,
    ).toBe(true);
  });

  it('menghasilkan feed iCal (.ics) valid termasuk RRULE tahunan', () => {
    const ics = buildIcalFeed([
      {
        id: 'ev-1',
        title: 'Ulang Tahun: Alya',
        description: 'Ulang tahun anggota',
        location: 'Lab EISD',
        startAt: new Date('2026-05-15T00:00:00.000Z'),
        endAt: new Date('2026-05-16T00:00:00.000Z'),
        category: 'BIRTHDAY',
        isRecurringYearly: true,
      },
    ]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('RRULE:FREQ=YEARLY');
    expect(ics).toContain('END:VCALENDAR');
  });
});
