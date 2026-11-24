# Modul Event (`src/modules/event`)

Mengelola kegiatan lab seperti kuliah umum, seminar, dan workshop (**tanpa tiket QR**): siklus status, kepanitiaan, pendaftaran publik (`/register/[slug]`), checklist presensi, ekspor peserta Excel/CSV, dan sertifikat PDF opsional (`pdfkit`).

- **Integrasi**: status `APPROVED` otomatis mendaftarkan agenda ke Kalender; status `COMPLETED` mencatat realisasi biaya ke Kas Core (`src/modules/core/public`).
- **KPI Provider (`public/index.ts`)**: `event.committee_count`.
- **Permissions**: `event.event.read`, `event.event.manage`.
