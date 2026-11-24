# Modul Core (`src/modules/core`)

Mengelola kas & transaksi sederhana (rupiah integer), inventaris aset lab, serta rapat/notulen & surat menyurat.

- **Kontrak Publik (`public/index.ts`)**: `recordCoreTransaction(...)` dipakai modul Event dan Enabler untuk mencatat pengeluaran realisasi event dan hadiah apresiasi secara idempotent.
- **Permissions**: `core.finance.read`, `core.finance.manage`, `core.record.manage`.
