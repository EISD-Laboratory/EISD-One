import { describe, expect, it } from 'vitest';
import {
  normalizeCustomFields,
  sanitizeModuleCode,
  validateCustomRecordData,
} from '@/core/custom-modules';

describe('Tahap 3 — Custom Module Builder & Validasi Dinamis', () => {
  it('menormalkan kode modul menjadi slug aman', () => {
    expect(sanitizeModuleCode('  Inventaris Buku Lab! ')).toBe('inventaris-buku-lab');
  });

  it('menolak skema Custom Module tanpa field atau dropdown tanpa opsi', () => {
    expect(() => normalizeCustomFields([])).toThrow(/Minimal 1 field/i);
    expect(() =>
      normalizeCustomFields([{ key: 'status', label: 'Status', type: 'select', options: [] }]),
    ).toThrow(/wajib memiliki opsi/i);
  });

  it('memvalidasi record sesuai tipe field, opsi select, dan kewajiban isi', () => {
    const fields = normalizeCustomFields([
      { key: 'kode_rak', label: 'Kode Rak', type: 'text', required: true },
      { key: 'jumlah', label: 'Jumlah', type: 'number', required: true },
      {
        key: 'kondisi',
        label: 'Kondisi',
        type: 'select',
        required: true,
        options: ['Baik', 'Perlu Perbaikan'],
      },
    ]);

    expect(() => validateCustomRecordData(fields, { jumlah: '5', kondisi: 'Baik' })).toThrow(
      /wajib diisi/i,
    );

    expect(() =>
      validateCustomRecordData(fields, {
        kode_rak: 'R-01',
        jumlah: 'bukan-angka',
        kondisi: 'Baik',
      }),
    ).toThrow(/berupa angka/i);

    expect(() =>
      validateCustomRecordData(fields, { kode_rak: 'R-01', jumlah: '3', kondisi: 'Hilang' }),
    ).toThrow(/tidak termasuk opsi/i);

    const valid = validateCustomRecordData(fields, {
      kode_rak: ' R-01 ',
      jumlah: '12',
      kondisi: 'Baik',
    });
    expect(valid).toEqual({ kode_rak: 'R-01', jumlah: 12, kondisi: 'Baik' });
  });
});
