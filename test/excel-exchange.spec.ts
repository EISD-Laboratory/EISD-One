import { ImportDuplicateStrategy } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { type SessionUser } from '@/core/auth';
import {
  applyColumnMapping,
  buildSuggestedColumnMapping,
  detectAndValidateFileFormat,
  generateCsvBuffer,
  generateXlsxBuffer,
  parseFlexibleDate,
  parseSpreadsheetBuffer,
  sanitizeFormulaCell,
} from '@/core/excel';
import { HttpError } from '@/core/http';
import { MEMBER_COLUMNS, validateMemberRow } from '@/core/member-import';

const admin: SessionUser = {
  id: 'u-admin',
  email: 'admin@eisd.local',
  fullName: 'Admin',
  isSuperAdmin: true,
  roles: [],
  permissions: [],
  divisionIds: [],
};

describe('Excel/CSV Data Exchange (Security & 200-Row Validation)', () => {
  it('mencegah CSV/Formula injection (=, +, -, @) dan menolak file makro/biner', () => {
    expect(sanitizeFormulaCell('=CMD()')).toBe(`'=CMD()`);
    expect(sanitizeFormulaCell('+1+2')).toBe(`'+1+2`);
    expect(sanitizeFormulaCell('-2+3')).toBe(`'-2+3`);
    expect(sanitizeFormulaCell('@SUM(A1)')).toBe(`'@SUM(A1)`);

    expect(() => detectAndValidateFileFormat(Buffer.from('x'), 'macro.xlsm')).toThrow(HttpError);
    expect(() => detectAndValidateFileFormat(Buffer.from([0x25, 0x50, 0x00]), 'fake.csv')).toThrow(
      HttpError,
    );

    const csv = generateCsvBuffer([{ key: 'name', label: 'Nama' }], [{ name: '=HYPERLINK("x")' }]);
    expect(csv.toString('utf8')).toContain(`'=HYPERLINK(""x"")`);
  });

  it('mem-parsing 200 baris anggota fiktif dari XLSX + 2 baris error dan CSV titik koma', async () => {
    const rows: Array<Record<string, unknown>> = [];
    for (let i = 1; i <= 200; i += 1) {
      rows.push({
        nim: `120226${String(i).padStart(4, '0')}`,
        fullName: `Anggota Fiktif ${i}`,
        email: `fiktif.${i}@example.edu`,
        birthDate: i % 2 === 0 ? '15/08/2004' : '2004-08-15',
        phone: `08120000${String(i).padStart(4, '0')}`,
        status: 'ACTIVE',
        batchYear: 2024,
        divisionCode: 'event',
        positionTitle: 'Staf Event',
      });
    }
    rows.push({
      nim: '',
      fullName: 'Tanpa NIM',
      email: 'bad-email',
      birthDate: '99/99/2004',
      divisionCode: 'event',
    });
    rows.push({ nim: '1202269999', fullName: 'Divisi Salah', divisionCode: 'tidak-ada' });

    const xlsxBuf = await generateXlsxBuffer('Members', MEMBER_COLUMNS, rows);
    const parsed = await parseSpreadsheetBuffer(xlsxBuf, '200-members.xlsx');
    expect(parsed.rows).toHaveLength(202);

    const mapping = buildSuggestedColumnMapping(parsed.headers, MEMBER_COLUMNS);
    const divByCode = new Map([['event', 'div-event']]);
    const seen = new Set<string>();

    let valid = 0;
    let failed = 0;
    for (const r of parsed.rows) {
      const mapped = applyColumnMapping(r.raw, mapping);
      const res = validateMemberRow(mapped, {
        actor: admin,
        divByCode,
        existingNims: new Set(),
        seenInBatch: seen,
        strategy: ImportDuplicateStrategy.SKIP,
      });
      if (res.valid) valid += 1;
      else failed += 1;
    }

    expect(valid).toBe(200);
    expect(failed).toBe(2);

    expect(parseFlexibleDate('25/08/2004')?.toISOString().slice(0, 10)).toBe('2004-08-25');
    const semiCsv = await parseSpreadsheetBuffer(
      Buffer.from('NIM;Nama Lengkap\n1202240001;Budi\n'),
      'semi.csv',
    );
    expect(semiCsv.rows[0].raw['Nama Lengkap']).toBe('Budi');
  }, 15_000);
});
