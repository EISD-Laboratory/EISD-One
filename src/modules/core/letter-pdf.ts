import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { composeLetterDocument, type LetterPayload } from './letter-templates';

/**
 * Menghasilkan file PDF resmi ukuran A4 siap cetak dari template surat EISD.
 */
export function generateOfficialLetterPdfBuffer(
  payload: LetterPayload,
  referenceNo: string,
): Promise<Buffer> {
  const docData = composeLetterDocument(payload, referenceNo);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 52, bottom: 52, left: 64, right: 64 },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const leftX = 64;
    const rightX = pageW - 64;
    const contentW = rightX - leftX;

    // 1. KOP SURAT (dengan Logo EISD)
    const logoPath = path.join(process.cwd(), 'public', 'images', 'eisd.png');
    const hasLogo = fs.existsSync(logoPath);
    if (hasLogo) {
      doc.image(logoPath, leftX, 42, { fit: [46, 46], align: 'center', valign: 'center' });
    }
    const headerTextX = hasLogo ? leftX + 54 : leftX;
    const headerTextW = hasLogo ? contentW - 54 : contentW;

    doc
      .font('Helvetica-Bold')
      .fontSize(11.5)
      .fillColor('#0f172a')
      .text(docData.letterhead.title, headerTextX, 46, { width: headerTextW, align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor('#334155')
      .text(docData.letterhead.subtitle, headerTextX, doc.y + 1, {
        width: headerTextW,
        align: 'center',
      });
    doc
      .fontSize(8.5)
      .fillColor('#64748b')
      .text(docData.letterhead.contact, headerTextX, doc.y + 1, {
        width: headerTextW,
        align: 'center',
      });

    const lineY = Math.max(doc.y + 8, 94);
    doc.lineWidth(2).strokeColor('#0f172a').moveTo(leftX, lineY).lineTo(rightX, lineY).stroke();
    doc
      .lineWidth(0.75)
      .strokeColor('#475569')
      .moveTo(leftX, lineY + 3.5)
      .lineTo(rightX, lineY + 3.5)
      .stroke();

    doc.y = lineY + 18;

    // 2. HEADER NOMOR / JUDUL
    if (docData.isCertificateStyle && docData.documentTitle) {
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#0f172a')
        .text(docData.documentTitle, leftX, doc.y, {
          width: contentW,
          align: 'center',
          underline: true,
        });
      doc
        .font('Helvetica')
        .fontSize(10.5)
        .fillColor('#334155')
        .text(`Nomor: ${docData.referenceNo}`, leftX, doc.y + 3, {
          width: contentW,
          align: 'center',
        });
      doc.moveDown(1.4);
    } else {
      const metaStartY = doc.y;
      // Tanggal kanan atas
      doc
        .font('Helvetica')
        .fontSize(10.5)
        .fillColor('#0f172a')
        .text(docData.dateLine, leftX, metaStartY, { width: contentW, align: 'right' });

      const metaRows = [
        ['Nomor', docData.referenceNo],
        ['Lampiran', docData.attachment],
        ['Perihal', docData.subject],
      ];
      let curY = metaStartY;
      for (const [label, val] of metaRows) {
        doc.font('Helvetica').fontSize(10.5).fillColor('#0f172a').text(label, leftX, curY, {
          width: 68,
        });
        doc.text(':', leftX + 68, curY, { width: 10 });
        doc
          .font(label === 'Perihal' ? 'Helvetica-Bold' : 'Helvetica')
          .text(val, leftX + 78, curY, { width: contentW - 210 });
        curY = Math.max(curY + 15, doc.y + 2);
      }

      doc.y = curY + 14;

      // Tujuan Surat
      doc.font('Helvetica').fontSize(10.5).fillColor('#0f172a');
      for (let i = 0; i < docData.recipientLines.length; i += 1) {
        doc
          .font(i === 1 ? 'Helvetica-Bold' : 'Helvetica')
          .text(docData.recipientLines[i], leftX, doc.y, { width: contentW });
      }
      doc.moveDown(1.1);
    }

    // 3. SALAM & PARAGRAF PEMBUKA
    if (docData.salutation) {
      doc.font('Helvetica').fontSize(10.5).fillColor('#0f172a').text(docData.salutation, leftX);
      doc.moveDown(0.5);
    }

    doc
      .font('Helvetica')
      .fontSize(10.5)
      .fillColor('#0f172a')
      .text(docData.openingParagraph, leftX, doc.y, {
        width: contentW,
        align: 'justify',
        lineGap: 3,
      });

    // 4. BLOK DETAIL TERSTRUKTUR
    if (docData.detailRows.length > 0) {
      doc.moveDown(0.75);
      const labelW = 128;
      const indentX = leftX + 22;
      for (const row of docData.detailRows) {
        const y = doc.y;
        doc.font('Helvetica').fontSize(10.5).fillColor('#0f172a').text(row.label, indentX, y, {
          width: labelW,
        });
        doc.text(':', indentX + labelW, y, { width: 12 });
        doc.font('Helvetica-Bold').text(row.value, indentX + labelW + 12, y, {
          width: contentW - 22 - labelW - 12,
          lineGap: 2,
        });
        doc.y = Math.max(y + 16, doc.y + 2);
      }
    }

    // 5. PARAGRAF TAMBAHAN & PENUTUP
    if (docData.middleParagraph) {
      doc.moveDown(0.75);
      doc
        .font('Helvetica')
        .fontSize(10.5)
        .fillColor('#0f172a')
        .text(docData.middleParagraph, leftX, doc.y, {
          width: contentW,
          align: 'justify',
          lineGap: 3,
        });
    }

    doc.moveDown(0.75);
    doc
      .font('Helvetica')
      .fontSize(10.5)
      .fillColor('#0f172a')
      .text(docData.closingParagraph, leftX, doc.y, {
        width: contentW,
        align: 'justify',
        lineGap: 3,
      });

    // 6. BLOK TANDA TANGAN
    doc.moveDown(1.8);
    if (docData.isCertificateStyle) {
      doc
        .font('Helvetica')
        .fontSize(10.5)
        .text(docData.dateLine, leftX, doc.y, { width: contentW, align: 'right' });
      doc.moveDown(0.5);
    }

    const sigTopY = doc.y;
    const colW = contentW / 2;

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#0f172a')
      .text('Hormat kami,', leftX, sigTopY, { width: colW, align: 'center' });
    doc.text(docData.signatories.chairLabel, leftX, sigTopY + 14, { width: colW, align: 'center' });

    doc.text('Mengetahui,', leftX + colW, sigTopY, { width: colW, align: 'center' });
    doc.text(docData.signatories.secretaryLabel, leftX + colW, sigTopY + 14, {
      width: colW,
      align: 'center',
    });

    const nameY = sigTopY + 76;
    doc.font('Helvetica-Bold').fontSize(10.5).text(docData.signatories.chairName, leftX, nameY, {
      width: colW,
      align: 'center',
      underline: true,
    });
    doc.text(docData.signatories.secretaryName, leftX + colW, nameY, {
      width: colW,
      align: 'center',
      underline: true,
    });

    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    if (docData.signatories.chairId) {
      doc.text(docData.signatories.chairId, leftX, nameY + 15, { width: colW, align: 'center' });
    }
    if (docData.signatories.secretaryId) {
      doc.text(docData.signatories.secretaryId, leftX + colW, nameY + 15, {
        width: colW,
        align: 'center',
      });
    }

    doc.end();
  });
}
