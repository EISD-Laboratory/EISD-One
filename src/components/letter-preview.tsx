'use client';

import { useMemo } from 'react';
import { composeLetterDocument, type LetterPayload } from '@/modules/core/letter-templates';

export function LetterPaperPreview({
  payload,
  referenceNo,
  compact = false,
}: {
  payload: LetterPayload;
  referenceNo: string;
  compact?: boolean;
}) {
  const doc = useMemo(() => composeLetterDocument(payload, referenceNo), [payload, referenceNo]);

  return (
    <div
      className={`letter-print-sheet mx-auto w-full rounded-xl border border-slate-200/90 bg-white text-slate-900 shadow-lg ${
        compact
          ? 'p-6 text-[11px] leading-relaxed sm:p-8'
          : 'max-w-[794px] p-10 text-[13px] leading-relaxed'
      }`}
      style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
    >
      {/* 1. KOP SURAT */}
      <div className="flex items-center gap-3 pb-3">
        <div
          className={`flex shrink-0 items-center justify-center ${
            compact ? 'h-12 w-12' : 'h-16 w-16'
          }`}
        >
          <img
            src="/images/eisd.png"
            alt="Logo Laboratorium EISD"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="flex-1 text-center">
          <p
            className={`font-bold uppercase tracking-wide text-slate-950 ${
              compact ? 'text-[11px]' : 'text-[13px]'
            }`}
          >
            {doc.letterhead.title}
          </p>
          <p className={`text-slate-700 ${compact ? 'text-[10px]' : 'text-[11.5px]'}`}>
            {doc.letterhead.subtitle}
          </p>
          <p className={`text-slate-500 ${compact ? 'text-[9px]' : 'text-[10.5px]'}`}>
            {doc.letterhead.contact}
          </p>
        </div>
      </div>
      <div className="mb-5 border-b-[2.5px] border-slate-900 pb-[2px]">
        <div className="border-b border-slate-700" />
      </div>

      {/* 2. HEADER NOMOR / JUDUL */}
      {doc.isCertificateStyle && doc.documentTitle ? (
        <div className="mb-5 text-center">
          <h2
            className={`font-bold uppercase tracking-wider underline underline-offset-4 ${
              compact ? 'text-sm' : 'text-base'
            }`}
          >
            {doc.documentTitle}
          </h2>
          <p className="mt-1 text-slate-700">Nomor: {doc.referenceNo}</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-start justify-between gap-4">
            <table className="border-collapse">
              <tbody>
                <tr>
                  <td className="pr-2 align-top">Nomor</td>
                  <td className="pr-1.5 align-top">:</td>
                  <td className="align-top font-semibold">{doc.referenceNo}</td>
                </tr>
                <tr>
                  <td className="pr-2 align-top">Lampiran</td>
                  <td className="pr-1.5 align-top">:</td>
                  <td className="align-top">{doc.attachment}</td>
                </tr>
                <tr>
                  <td className="pr-2 align-top">Perihal</td>
                  <td className="pr-1.5 align-top">:</td>
                  <td className="align-top font-bold">{doc.subject}</td>
                </tr>
              </tbody>
            </table>
            <p className="shrink-0 whitespace-nowrap text-right">{doc.dateLine}</p>
          </div>

          <div className="mb-4">
            {doc.recipientLines.map((line, i) => (
              <p key={i} className={i === 1 ? 'font-bold' : ''}>
                {line}
              </p>
            ))}
          </div>
        </>
      )}

      {/* 3. SALAM & PEMBUKA */}
      {doc.salutation && <p className="mb-2.5">{doc.salutation}</p>}
      <p className="text-justify">{doc.openingParagraph}</p>

      {/* 4. BLOK DETAIL TERSTRUKTUR */}
      {doc.detailRows.length > 0 && (
        <div className="my-3.5 pl-4">
          <table className="w-full border-collapse">
            <tbody>
              {doc.detailRows.map((row) => (
                <tr key={row.label}>
                  <td className="w-36 py-0.5 pr-2 align-top text-slate-700">{row.label}</td>
                  <td className="w-3 py-0.5 align-top">:</td>
                  <td className="py-0.5 align-top font-semibold text-slate-950">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. PARAGRAF TAMBAHAN & PENUTUP */}
      {doc.middleParagraph && <p className="mb-2.5 text-justify">{doc.middleParagraph}</p>}
      <p className="mt-2.5 text-justify">{doc.closingParagraph}</p>

      {/* 6. TANDA TANGAN */}
      <div className="mt-7">
        {doc.isCertificateStyle && <p className="mb-3 text-right">{doc.dateLine}</p>}
        <div className="grid grid-cols-2 gap-6 text-center">
          <div>
            <p>Hormat kami,</p>
            <p>{doc.signatories.chairLabel}</p>
            <div className={compact ? 'h-12' : 'h-16'} />
            <p className="font-bold underline underline-offset-2">{doc.signatories.chairName}</p>
            {doc.signatories.chairId && (
              <p className="text-[10px] text-slate-600">{doc.signatories.chairId}</p>
            )}
          </div>
          <div>
            <p>Mengetahui,</p>
            <p>{doc.signatories.secretaryLabel}</p>
            <div className={compact ? 'h-12' : 'h-16'} />
            <p className="font-bold underline underline-offset-2">
              {doc.signatories.secretaryName}
            </p>
            {doc.signatories.secretaryId && (
              <p className="text-[10px] text-slate-600">{doc.signatories.secretaryId}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
