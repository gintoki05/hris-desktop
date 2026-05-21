# Portal Owner Dashboard Next Step

Rencana kecil untuk repo HRIS Portal Employees agar Owner/Manajemen bisa membaca ringkasan payroll dari table `payroll_report_summaries`.

## Scope

- Tambahkan halaman/dashboard read-only untuk user Supabase Auth dengan `app_metadata.role = owner_management`.
- Baca hanya table `public.payroll_report_summaries`.
- Tampilkan agregat periode: periode payroll, tanggal mulai/akhir, jumlah karyawan, gross pay, total potongan, net pay, komponen pendapatan, komponen potongan, jumlah slip published, jumlah slip gagal, dan waktu update.
- Jangan tampilkan atau query NIK, NPWP, nomor WhatsApp, nama/email karyawan, local PDF path, atau snapshot JSON.

## Data Access

Gunakan Supabase client portal yang sudah ada.

```ts
const { data, error } = await supabase
  .from("payroll_report_summaries")
  .select(`
    id,
    desktop_period_id,
    payroll_period,
    period_start,
    period_end,
    employee_count,
    gross_pay,
    total_deductions,
    net_pay,
    income_components,
    deduction_components,
    payslip_published_count,
    payslip_failed_count,
    published_at,
    updated_at
  `)
  .order("period_start", { ascending: false });
```

RLS tetap menjadi pengaman utama. Portal UI juga sebaiknya menyembunyikan menu ini bila role dari session bukan `owner_management`, tetapi jangan menjadikan UI guard sebagai satu-satunya proteksi.

## UI Minimum

- Tambahkan menu `Laporan Payroll` untuk Owner/Manajemen.
- Header ringkas: periode terbaru, total net pay, jumlah karyawan, status slip published/failed.
- Table per periode dengan pagination sederhana.
- Detail periode menampilkan breakdown komponen agregat dari `income_components` dan `deduction_components`.
- Empty state: belum ada laporan owner yang dipublish dari desktop.
- Error state: tampilkan pesan umum tanpa secret atau payload mentah.

## Acceptance Criteria

- Owner/Manajemen bisa melihat ringkasan yang sudah dipublish desktop.
- User karyawan biasa tidak bisa membaca table, baik dari UI maupun direct Supabase query karena RLS.
- Tidak ada data per karyawan di payload, UI, log, atau error detail.
- Refresh setelah desktop publish ulang periode yang sama menampilkan satu baris periode yang ter-update, bukan duplikat.
