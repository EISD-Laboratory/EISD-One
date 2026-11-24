import { Readable } from 'node:stream';
import { parse as parseCsv } from 'csv-parse';
import ExcelJS from 'exceljs';
import * as iconv from 'iconv-lite';
import { HttpError } from './http';

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

export interface SheetColumn {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
  aliases?: string[];
}

export interface ParsedSheet {
  format: 'xlsx' | 'csv';
  headers: string[];
  rows: Array<{ rowNumber: number; raw: Record<string, string> }>;
}

/** Validasi isi/magic bytes file — menolak makro (.xlsm/vbaProject.bin) dan file biner palsu. */
export function detectAndValidateFileFormat(buffer: Buffer, fileName: string): 'xlsx' | 'csv' {
  if (!buffer || buffer.length === 0) {
    throw new HttpError(400, 'File kosong.');
  }
  if (buffer.length > MAX_IMPORT_FILE_BYTES) {
    throw new HttpError(400, 'Ukuran file melebihi batas maksimum 5 MB.');
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsm') || lower.endsWith('.xlsb') || lower.endsWith('.xls')) {
    throw new HttpError(
      400,
      'Format Excel bermakro (.xlsm/.xls) ditolak demi keamanan. Gunakan .xlsx atau .csv.',
    );
  }

  const isZip =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  if (isZip) {
    if (buffer.includes(Buffer.from('vbaProject.bin'))) {
      throw new HttpError(400, 'File mengandung makro VBA dan ditolak.');
    }
    return 'xlsx';
  }

  if (buffer.subarray(0, Math.min(buffer.length, 2048)).includes(0x00)) {
    throw new HttpError(400, 'Isi file terdeteksi biner dan bukan CSV/XLSX yang valid.');
  }
  return 'csv';
}

export function decodeCsvBuffer(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8');
  }
  const utf8 = buffer.toString('utf8');
  return utf8.includes('\uFFFD') ? iconv.decode(buffer, 'win1252') : utf8;
}

export function parseFlexibleDate(value: string | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) return buildUtcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (dmy) return buildUtcDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));

  return null;
}

function buildUtcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

function safeCellText(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'object') {
    if ('text' in val && typeof val.text === 'string') return val.text.trim();
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText
        .map((r) => r.text)
        .join('')
        .trim();
    }
    if ('result' in val && val.result !== undefined && val.result !== null) {
      if (val.result instanceof Date) return val.result.toISOString().slice(0, 10);
      if (typeof val.result === 'string' || typeof val.result === 'number') {
        return String(val.result).trim();
      }
    }
    return '';
  }
  return String(val).trim();
}

export async function parseSpreadsheetBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<ParsedSheet> {
  const format = detectAndValidateFileFormat(buffer, fileName);

  if (format === 'csv') {
    const text = decodeCsvBuffer(buffer);
    const firstLine = text.split(/\r?\n/)[0] ?? '';
    const delimiter =
      (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ';' : ',';
    const rows: Array<{ rowNumber: number; raw: Record<string, string> }> = [];
    let headers: string[] = [];

    const parser = Readable.from([text]).pipe(
      parseCsv({ delimiter, relax_column_count: true, skip_empty_lines: true, trim: true }),
    );
    let idx = 0;
    for await (const rec of parser) {
      const cells = (rec as string[]).map((c) => String(c ?? '').trim());
      idx += 1;
      if (idx === 1) {
        headers = cells.filter(Boolean);
        continue;
      }
      if (rows.length >= MAX_IMPORT_ROWS) {
        throw new HttpError(400, `Jumlah baris melebihi batas ${MAX_IMPORT_ROWS}.`);
      }
      const raw: Record<string, string> = {};
      headers.forEach((h, i) => {
        raw[h] = cells[i] ?? '';
      });
      rows.push({ rowNumber: idx, raw });
    }
    if (headers.length === 0) throw new HttpError(400, 'Header CSV tidak ditemukan.');
    return { format: 'csv', headers, rows };
  }

  const headers: string[] = [];
  const rows: Array<{ rowNumber: number; raw: Record<string, string> }> = [];
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from([buffer]), {
    entries: 'emit',
    sharedStrings: 'cache',
    worksheets: 'emit',
    hyperlinks: 'ignore',
    styles: 'ignore',
  });

  let doneFirst = false;
  for await (const ws of reader) {
    if (doneFirst) break;
    doneFirst = true;
    for await (const row of ws) {
      const values = Array.isArray(row.values) ? row.values : [];
      if (row.number === 1) {
        for (let c = 1; c < values.length; c += 1) {
          const h = safeCellText(values[c] as ExcelJS.CellValue);
          if (h) headers.push(h);
        }
        continue;
      }
      if (rows.length >= MAX_IMPORT_ROWS) {
        throw new HttpError(400, `Jumlah baris melebihi batas ${MAX_IMPORT_ROWS}.`);
      }
      const raw: Record<string, string> = {};
      let nonEmpty = false;
      headers.forEach((h, i) => {
        const v = safeCellText(values[i + 1] as ExcelJS.CellValue);
        raw[h] = v;
        if (v) nonEmpty = true;
      });
      if (nonEmpty) rows.push({ rowNumber: row.number, raw });
    }
  }
  if (headers.length === 0) throw new HttpError(400, 'Header XLSX tidak ditemukan.');
  return { format: 'xlsx', headers, rows };
}

export function buildSuggestedColumnMapping(
  fileHeaders: string[],
  columns: SheetColumn[],
): Record<string, string> {
  const norm = fileHeaders.map((h) => ({
    orig: h,
    clean: h.toLowerCase().replace(/[^a-z0-9]/g, ''),
  }));
  const mapping: Record<string, string> = {};
  for (const col of columns) {
    const candidates = [col.key, col.label, ...(col.aliases ?? [])].map((c) =>
      c.toLowerCase().replace(/[^a-z0-9]/g, ''),
    );
    const match = norm.find((h) => candidates.includes(h.clean));
    if (match) mapping[col.key] = match.orig;
  }
  return mapping;
}

export function applyColumnMapping(
  raw: Record<string, string>,
  mapping: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [target, src] of Object.entries(mapping)) {
    if (src) out[target] = (raw[src] ?? '').trim();
  }
  return out;
}

/** Cegah CSV/Formula injection (=, +, -, @, tab, CR). */
export function sanitizeFormulaCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export async function generateXlsxBuffer(
  sheetName: string,
  columns: SheetColumn[],
  rows: Array<Record<string, unknown>>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EISD One';
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.max(c.label.length + 6, 18),
  }));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

  for (const row of rows) {
    const safe: Record<string, string> = {};
    for (const c of columns) safe[c.key] = sanitizeFormulaCell(row[c.key]);
    ws.addRow(safe);
  }
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}

export function generateCsvBuffer(
  columns: SheetColumn[],
  rows: Array<Record<string, unknown>>,
): Buffer {
  const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [columns.map((c) => esc(c.label)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => esc(sanitizeFormulaCell(row[c.key]))).join(','));
  }
  return Buffer.from(lines.join('\r\n'), 'utf8');
}
