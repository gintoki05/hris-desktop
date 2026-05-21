# Portal Owner Publish Contract

Dokumen ini mendefinisikan kontrak data minimum yang dipublish dari desktop HRIS Payroll ke HRIS Portal Employees untuk akses Owner/Manajemen.

## Prinsip

- Desktop lokal tetap source of truth.
- Portal hanya menerima data yang dipublish eksplisit oleh Admin Payroll.
- Owner/Manajemen melihat laporan ringkas aman, bukan data payroll mentah per karyawan.
- Akun owner portal berasal dari Manajemen User desktop role `owner_management`, bukan dari master karyawan.
- Slip PDF tetap milik karyawan terkait kecuali ada kebijakan eksplisit untuk membuka slip tertentu kepada owner.
- Backup database tidak dipublish sebagai raw SQLite. Jika dibutuhkan, gunakan paket backup terenkripsi dengan expiry dan audit terpisah.

## Owner Portal Accounts

Desktop menyimpan linkage owner portal pada table lokal `auth_users`:

- `role_id = 'owner_management'`
- `portal_email`
- `portal_user_id`

Admin Payroll boleh membuat atau menautkan akun Supabase Auth owner dari menu Manajemen User desktop. Saat akun dibuat atau disinkron, desktop harus memastikan Supabase Auth user memiliki:

```json
{
  "app_metadata": {
    "role": "owner_management"
  }
}
```

Jangan memakai `user_metadata.role` untuk otorisasi owner karena metadata itu tidak aman untuk RLS.

## Payroll Report Summaries

Desktop publish ke table portal `payroll_report_summaries` dengan upsert key `desktop_period_id`.

Payload yang dikirim:

```json
{
  "desktop_period_id": "payslip-period-id",
  "payroll_period": "Mei 2026",
  "period_start": "2026-05-01",
  "period_end": "2026-05-31",
  "employee_count": 25,
  "gross_pay": 0,
  "total_deductions": 0,
  "net_pay": 0,
  "income_components": [
    { "name": "Gaji Pokok", "amount": 0 }
  ],
  "deduction_components": [
    { "name": "BPJS Kesehatan", "amount": 0 }
  ],
  "payslip_published_count": 25,
  "payslip_failed_count": 0
}
```

Payload ini tidak boleh berisi NIK, NPWP, nomor WhatsApp, email karyawan, nama karyawan, path lokal PDF, atau snapshot JSON lengkap.

## RLS Minimum Portal

- Role `owner_management` boleh `SELECT` dari `payroll_report_summaries`.
- Role karyawan biasa tidak boleh membaca `payroll_report_summaries`.
- Table `payslips` tetap dibatasi agar karyawan hanya membaca slip miliknya.
- Admin service key dari desktop boleh `INSERT`/`UPDATE` data publish.
- Owner tidak boleh `INSERT`, `UPDATE`, `DELETE`, atau restore backup.

## Backup Portal

Belum diimplementasikan di desktop. Jika owner perlu download backup:

- Desktop membuat backup lokal terlebih dahulu.
- Backup dipaketkan sebagai file terenkripsi, bukan raw `.sqlite3`.
- Metadata portal minimum: file path storage, checksum, size, created_at, expires_at, published_by, reason.
- Owner hanya bisa download paket yang masih aktif dan diizinkan.
- Password/encryption key diberikan manual di luar portal.
