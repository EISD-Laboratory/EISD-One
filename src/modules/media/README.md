# Modul Media (`src/modules/media`)

- **Tanggung jawab:** Antrean permintaan desain/konten antar-divisi (`REQUESTED → IN_PROGRESS → REVIEW → PUBLISHED`), jadwal publikasi konten, dan tautan hasil desain.
- **Tabel:** `media_requests`.
- **Integrasi:**
  - Kalender EISD: jadwal `publishAt` dapat otomatis disinkronkan ke kalender.
  - KPI Engine: menyediakan sumber `media.completed_tasks` melalui `src/modules/media/public/index.ts`.
