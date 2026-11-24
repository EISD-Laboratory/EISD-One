export type LetterTemplateCode = 'UND' | 'PMH' | 'PJM' | 'SKT' | 'STG' | 'UMM';

export interface LetterTemplateMeta {
  code: LetterTemplateCode;
  name: string;
  shortLabel: string;
  description: string;
  defaultSubject: string;
  defaultAttachment: string;
  style: 'correspondence' | 'certificate';
  documentTitle?: string;
}

export const LETTER_TEMPLATES: LetterTemplateMeta[] = [
  {
    code: 'UND',
    name: 'Surat Undangan',
    shortLabel: 'Undangan',
    description: 'Undangan rapat, seminar, kuliah umum, atau kunjungan resmi.',
    defaultSubject: 'Undangan Kegiatan Laboratorium EISD',
    defaultAttachment: '-',
    style: 'correspondence',
  },
  {
    code: 'PMH',
    name: 'Surat Permohonan',
    shortLabel: 'Permohonan',
    description: 'Permohonan narasumber, kerja sama, sponsorship, atau dispensasi.',
    defaultSubject: 'Permohonan Narasumber / Kerja Sama',
    defaultAttachment: '1 (satu) berkas',
    style: 'correspondence',
  },
  {
    code: 'PJM',
    name: 'Surat Peminjaman',
    shortLabel: 'Peminjaman',
    description: 'Peminjaman ruangan, auditorium, proyektor, atau inventaris kampus.',
    defaultSubject: 'Permohonan Peminjaman Ruangan / Peralatan',
    defaultAttachment: '-',
    style: 'correspondence',
  },
  {
    code: 'SKT',
    name: 'Surat Keterangan Aktif',
    shortLabel: 'Keterangan',
    description: 'Keterangan keaktifan anggota, pengurus, atau asisten lab EISD.',
    defaultSubject: 'Surat Keterangan Anggota Aktif EISD',
    defaultAttachment: '-',
    style: 'certificate',
    documentTitle: 'SURAT KETERANGAN',
  },
  {
    code: 'STG',
    name: 'Surat Tugas',
    shortLabel: 'Surat Tugas',
    description: 'Penugasan delegasi lomba, penelitian, atau perwakilan resmi lab.',
    defaultSubject: 'Surat Tugas Delegasi Laboratorium EISD',
    defaultAttachment: '-',
    style: 'certificate',
    documentTitle: 'SURAT TUGAS',
  },
  {
    code: 'UMM',
    name: 'Surat Pemberitahuan / Umum',
    shortLabel: 'Umum',
    description: 'Surat edaran, pemberitahuan resmi, atau korespondensi umum.',
    defaultSubject: 'Pemberitahuan Resmi Laboratorium EISD',
    defaultAttachment: '-',
    style: 'correspondence',
  },
];

export interface LetterPayload {
  templateCode: LetterTemplateCode;
  letterDate: string; // YYYY-MM-DD
  city: string;
  attachment: string;
  subject: string;
  recipientName: string;
  recipientOrg: string;
  recipientPlace: string;
  purpose: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  itemDetails: string;
  memberName: string;
  memberNim: string;
  memberDivision: string;
  periodName: string;
  customBody: string;
  chairName: string;
  chairId: string;
  secretaryName: string;
  secretaryId: string;
}

export interface ComposedLetter {
  template: LetterTemplateMeta;
  letterhead: {
    title: string;
    subtitle: string;
    contact: string;
  };
  referenceNo: string;
  attachment: string;
  subject: string;
  dateLine: string;
  isCertificateStyle: boolean;
  documentTitle: string | null;
  recipientLines: string[];
  salutation: string | null;
  openingParagraph: string;
  detailRows: Array<{ label: string; value: string }>;
  middleParagraph: string | null;
  closingParagraph: string;
  signatories: {
    orgLine: string;
    chairLabel: string;
    chairName: string;
    chairId: string;
    secretaryLabel: string;
    secretaryName: string;
    secretaryId: string;
  };
}

const ROMAN_MONTHS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
] as const;

const ID_MONTHS = [
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
] as const;

export function toRomanMonth(month1Based: number): string {
  return ROMAN_MONTHS[Math.max(0, Math.min(11, month1Based - 1))] ?? 'I';
}

export function formatIndonesianDate(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!m) return dateStr;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const monthName = ID_MONTHS[month - 1] ?? m[2];
  return `${day} ${monthName} ${year}`;
}

export function formatAutoLetterNumber(
  sequenceNo: number,
  templateCode: LetterTemplateCode,
  dateStr: string,
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  const year = m ? Number(m[1]) : new Date().getFullYear();
  const month = m ? Number(m[2]) : new Date().getMonth() + 1;
  const seqPadded = String(Math.max(1, sequenceNo)).padStart(3, '0');
  return `${seqPadded}/${templateCode}/EISD/${toRomanMonth(month)}/${year}`;
}

export function getTemplateMeta(code: LetterTemplateCode): LetterTemplateMeta {
  return LETTER_TEMPLATES.find((t) => t.code === code) ?? LETTER_TEMPLATES[0];
}

export function getDefaultLetterPayload(
  templateCode: LetterTemplateCode = 'UND',
  todayIso = new Date().toISOString().slice(0, 10),
): LetterPayload {
  const meta = getTemplateMeta(templateCode);
  return {
    templateCode,
    letterDate: todayIso,
    city: 'Bandung',
    attachment: meta.defaultAttachment,
    subject: meta.defaultSubject,
    recipientName: '',
    recipientOrg: '',
    recipientPlace: 'Tempat',
    purpose: '',
    eventDate: '',
    eventTime: '',
    eventLocation: '',
    itemDetails: '',
    memberName: '',
    memberNim: '',
    memberDivision: '',
    periodName: '2026/2027',
    customBody: '',
    chairName: 'Alya Pratama',
    chairId: 'NIM. 1202220001',
    secretaryName: 'Bima Mahendra',
    secretaryId: 'NIM. 1202220002',
  };
}

export function composeLetterDocument(payload: LetterPayload, referenceNo: string): ComposedLetter {
  const template = getTemplateMeta(payload.templateCode);
  const city = payload.city.trim() || 'Bandung';
  const dateLine = `${city}, ${formatIndonesianDate(payload.letterDate)}`;
  const purpose = payload.purpose.trim() || '[Keperluan / Nama Kegiatan]';
  const recipientName = payload.recipientName.trim() || '[Nama / Jabatan Penerima]';
  const recipientOrg = payload.recipientOrg.trim();
  const recipientPlace = payload.recipientPlace.trim() || 'Tempat';

  const recipientLines = ['Kepada Yth.', recipientName];
  if (recipientOrg) recipientLines.push(recipientOrg);
  recipientLines.push(`di ${recipientPlace}`);

  const detailRows: Array<{ label: string; value: string }> = [];
  let openingParagraph = '';
  let middleParagraph: string | null = payload.customBody.trim() || null;
  let closingParagraph =
    'Demikian surat ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu/Saudara, kami ucapkan terima kasih.';

  switch (payload.templateCode) {
    case 'UND': {
      openingParagraph = `Sehubungan dengan akan dilaksanakannya kegiatan ${purpose} yang diselenggarakan oleh Laboratorium Enterprise Intelligence & System Development (EISD), dengan ini kami mengundang Bapak/Ibu/Saudara untuk dapat berkenan hadir pada kegiatan tersebut yang akan dilaksanakan pada:`;
      if (payload.eventDate.trim())
        detailRows.push({ label: 'Hari, Tanggal', value: payload.eventDate.trim() });
      if (payload.eventTime.trim())
        detailRows.push({ label: 'Waktu', value: payload.eventTime.trim() });
      if (payload.eventLocation.trim())
        detailRows.push({ label: 'Tempat', value: payload.eventLocation.trim() });
      if (payload.itemDetails.trim())
        detailRows.push({ label: 'Agenda / Acara', value: payload.itemDetails.trim() });
      closingParagraph =
        'Besar harapan kami agar Bapak/Ibu/Saudara dapat menghadiri kegiatan tersebut. Atas perhatian dan kehadirannya, kami ucapkan terima kasih.';
      break;
    }

    case 'PMH': {
      openingParagraph = `Dalam rangka mendukung pelaksanaan program kerja Laboratorium EISD khususnya pada kegiatan ${purpose}, bersama surat ini kami bermaksud mengajukan permohonan kepada Bapak/Ibu/Saudara sesuai dengan rincian berikut:`;
      detailRows.push({ label: 'Keperluan', value: purpose });
      if (payload.eventDate.trim())
        detailRows.push({ label: 'Hari, Tanggal', value: payload.eventDate.trim() });
      if (payload.eventTime.trim())
        detailRows.push({ label: 'Waktu', value: payload.eventTime.trim() });
      if (payload.eventLocation.trim())
        detailRows.push({ label: 'Tempat', value: payload.eventLocation.trim() });
      if (payload.itemDetails.trim())
        detailRows.push({ label: 'Rincian Permohonan', value: payload.itemDetails.trim() });
      closingParagraph =
        'Demikian surat permohonan ini kami ajukan. Atas perhatian, dukungan, dan kerja sama Bapak/Ibu/Saudara, kami sampaikan terima kasih.';
      break;
    }

    case 'PJM': {
      openingParagraph = `Sehubungan dengan akan diadakannya kegiatan ${purpose} oleh Laboratorium EISD, bersama ini kami mengajukan permohonan peminjaman ruangan/peralatan untuk mendukung kelancaran kegiatan tersebut dengan rincian sebagai berikut:`;
      if (payload.itemDetails.trim())
        detailRows.push({ label: 'Ruangan / Barang', value: payload.itemDetails.trim() });
      if (payload.eventDate.trim())
        detailRows.push({ label: 'Tanggal Pinjam', value: payload.eventDate.trim() });
      if (payload.eventTime.trim())
        detailRows.push({ label: 'Waktu Penggunaan', value: payload.eventTime.trim() });
      if (payload.eventLocation.trim())
        detailRows.push({ label: 'Lokasi / PIC', value: payload.eventLocation.trim() });
      closingParagraph =
        'Kami berkomitmen menjaga kebersihan, ketertiban, dan keutuhan fasilitas yang dipinjam serta mengembalikannya tepat waktu. Atas izin dan bantuannya, kami ucapkan terima kasih.';
      break;
    }

    case 'SKT': {
      const mName = payload.memberName.trim() || '[Nama Lengkap Anggota]';
      const mNim = payload.memberNim.trim() || '[NIM]';
      const mDiv = payload.memberDivision.trim() || '[Divisi / Jabatan]';
      const period = payload.periodName.trim() || '2026/2027';
      openingParagraph =
        'Yang bertanda tangan di bawah ini, Pengurus Laboratorium Enterprise Intelligence & System Development (EISD), dengan ini menerangkan bahwa:';
      detailRows.push({ label: 'Nama Lengkap', value: mName });
      detailRows.push({ label: 'NIM', value: mNim });
      detailRows.push({ label: 'Divisi / Jabatan', value: mDiv });
      detailRows.push({ label: 'Periode Kepengurusan', value: period });
      if (payload.purpose.trim()) {
        detailRows.push({ label: 'Keperluan', value: payload.purpose.trim() });
      }
      middleParagraph =
        payload.customBody.trim() ||
        `Adalah benar merupakan anggota aktif Laboratorium EISD pada periode kepengurusan ${period} dan telah menjalankan tugas serta tanggung jawabnya dengan baik.`;
      closingParagraph =
        'Demikian surat keterangan ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.';
      break;
    }

    case 'STG': {
      const mName = payload.memberName.trim() || '[Nama Anggota / Tim]';
      const mNim = payload.memberNim.trim() || '-';
      const mDiv = payload.memberDivision.trim() || 'Anggota Laboratorium EISD';
      openingParagraph =
        'Pengurus Laboratorium Enterprise Intelligence & System Development (EISD) dengan ini memberikan tugas kepada:';
      detailRows.push({ label: 'Nama / Tim', value: mName });
      if (mNim && mNim !== '-') detailRows.push({ label: 'NIM', value: mNim });
      detailRows.push({ label: 'Divisi / Jabatan', value: mDiv });
      detailRows.push({ label: 'Keperluan / Tugas', value: purpose });
      if (payload.eventDate.trim())
        detailRows.push({ label: 'Tanggal Pelaksanaan', value: payload.eventDate.trim() });
      if (payload.eventLocation.trim())
        detailRows.push({ label: 'Lokasi / Penyelenggara', value: payload.eventLocation.trim() });
      if (payload.itemDetails.trim())
        detailRows.push({ label: 'Keterangan', value: payload.itemDetails.trim() });
      closingParagraph =
        'Demikian surat tugas ini diterbitkan untuk dilaksanakan dengan penuh tanggung jawab dan melaporkan hasilnya kepada pengurus Laboratorium EISD.';
      break;
    }

    case 'UMM':
    default: {
      openingParagraph =
        payload.customBody.trim() ||
        `Sehubungan dengan ${purpose}, melalui surat ini kami pengurus Laboratorium EISD menyampaikan informasi resmi terkait hal tersebut kepada Bapak/Ibu/Saudara.`;
      middleParagraph = null;
      if (payload.eventDate.trim())
        detailRows.push({ label: 'Tanggal', value: payload.eventDate.trim() });
      if (payload.eventTime.trim())
        detailRows.push({ label: 'Waktu', value: payload.eventTime.trim() });
      if (payload.eventLocation.trim())
        detailRows.push({ label: 'Tempat', value: payload.eventLocation.trim() });
      if (payload.itemDetails.trim())
        detailRows.push({ label: 'Keterangan', value: payload.itemDetails.trim() });
      break;
    }
  }

  return {
    template,
    letterhead: {
      title: 'LABORATORIUM ENTERPRISE INTELLIGENCE & SYSTEM DEVELOPMENT (EISD)',
      subtitle: 'Program Studi Sistem Informasi · Fakultas Rekayasa Industri',
      contact: 'Gedung Laboratorium EISD · Email: eisd@lab.ac.id · eisd-one.local',
    },
    referenceNo,
    attachment: payload.attachment.trim() || '-',
    subject: payload.subject.trim() || template.defaultSubject,
    dateLine,
    isCertificateStyle: template.style === 'certificate',
    documentTitle: template.documentTitle ?? null,
    recipientLines,
    salutation: template.style === 'correspondence' ? 'Dengan hormat,' : null,
    openingParagraph,
    detailRows,
    middleParagraph,
    closingParagraph,
    signatories: {
      orgLine: 'Pengurus Laboratorium EISD',
      chairLabel: 'Ketua Laboratorium EISD',
      chairName: payload.chairName.trim() || 'Ketua Laboratorium',
      chairId: payload.chairId.trim(),
      secretaryLabel: 'Sekretaris Laboratorium EISD',
      secretaryName: payload.secretaryName.trim() || 'Sekretaris Laboratorium',
      secretaryId: payload.secretaryId.trim(),
    },
  };
}
