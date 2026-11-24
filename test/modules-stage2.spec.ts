import { describe, expect, it } from 'vitest';
import { HttpError } from '@/core/http';
import { generateOfficialLetterPdfBuffer } from '@/modules/core/letter-pdf';
import { formatAutoLetterNumber, getDefaultLetterPayload } from '@/modules/core/letter-templates';
import { validateStaffOfTheMonthSelection } from '@/modules/enabler/enabler.service';
import { generateCertificatePdfBuffer, slugifyEventTitle } from '@/modules/event/event.service';

describe('Tahap 2 — Event (tanpa QR) & Enabler Business Rules', () => {
  it('menghasilkan sertifikat PDF valid (%PDF-) untuk peserta kuliah umum dan slug unik', async () => {
    const slug = slugifyEventTitle('Kuliah Umum Enterprise Architecture 2026!');
    expect(slug).toMatch(/^kuliah-umum-enterprise-architecture-2026-/);

    const pdf = await generateCertificatePdfBuffer({
      participantName: 'Alya Pratama',
      roleLabel: 'Peserta',
      eventTitle: 'Kuliah Umum Enterprise Architecture 2026',
      eventDate: '2026-12-05',
      certificateNo: 'CERT-EISD-2026-TEST01',
    });
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });

  it('mewajibkan alasan saat override manual Staff of the Month (bukan peringkat #1 KPI)', () => {
    // Peringkat #1 KPI tidak butuh alasan override
    expect(
      validateStaffOfTheMonthSelection({
        selectedMemberId: 'mem-1',
        topRankedMemberId: 'mem-1',
      }),
    ).toEqual({ isOverride: false });

    // Override ke #2 tanpa alasan -> DITOLAK
    expect(() =>
      validateStaffOfTheMonthSelection({
        selectedMemberId: 'mem-2',
        topRankedMemberId: 'mem-1',
        overrideReason: '',
      }),
    ).toThrow(HttpError);

    // Override ke #2 dengan alasan jelas -> DITERIMA
    expect(
      validateStaffOfTheMonthSelection({
        selectedMemberId: 'mem-2',
        topRankedMemberId: 'mem-1',
        overrideReason: 'Kontribusi luar biasa saat menjadi koordinator kuliah umum.',
      }),
    ).toEqual({ isOverride: true });
  });

  it('menghasilkan nomor surat otomatis berformat baku dan PDF A4 resmi EISD', async () => {
    const refNo = formatAutoLetterNumber(7, 'UND', '2026-11-24');
    expect(refNo).toBe('007/UND/EISD/XI/2026');

    const payload = {
      ...getDefaultLetterPayload('UND', '2026-11-24'),
      recipientName: 'Dr. Budi Santoso',
      recipientOrg: 'Fakultas Rekayasa Industri',
      purpose: 'Kuliah Umum Enterprise Architecture 2026',
      eventDate: 'Sabtu, 5 Desember 2026',
      eventTime: '09.00 - 12.00 WIB',
      eventLocation: 'Auditorium Gedung A',
    };
    const pdf = await generateOfficialLetterPdfBuffer(payload, refNo);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(800);
  });
});
