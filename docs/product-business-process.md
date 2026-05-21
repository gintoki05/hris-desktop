# Product Business Process

Dokumen ini adalah acuan produk untuk HRIS, aplikasi desktop HRIS Payroll klinik dan HRIS Portal Employees di `karyawan.permatamedikaplg.com`. Gunakan dokumen ini saat merancang, mengubah, atau meninjau fitur auth, database, absensi, payroll, slip PDF, pengiriman slip, backup, portal employees, akses owner, dan laporan.

Tujuan utama HRIS adalah membantu admin payroll menjalankan proses penggajian bulanan secara aman dari aplikasi desktop lokal. Owner/manajemen tidak perlu memakai aplikasi desktop; owner mengakses laporan dan data yang dibutuhkan melalui HRIS Portal Employees.

## Prinsip Produk

- Simple Desktop + Portal Employees Mode adalah target produk saat ini. Desktop lokal tetap menjadi aplikasi utama untuk admin payroll.
- SQLite lokal tetap menjadi source of truth untuk data operasional desktop selama belum ada kebutuhan multi-user online penuh.
- Owner/manajemen memakai HRIS Portal Employees di `karyawan.permatamedikaplg.com` untuk melihat laporan, slip, backup yang dipublikasikan, atau data manajemen yang diperlukan.
- Portal employees tetap menjadi jalur internet utama untuk karyawan/ESS dan owner/manajemen. Jangan membuat owner wajib install desktop.
- Data payroll dan karyawan bersifat sensitif. Jangan log NIK, NPWP, nomor WhatsApp, nominal payroll detail, atau isi slip.
- Data final tidak boleh berubah diam-diam. Koreksi setelah finalisasi harus menjadi revisi yang terlacak.
- Snapshot lebih penting daripada live master data untuk payroll final, slip PDF, dan laporan periode lama.
- Fitur hapus harus konservatif. Data final lebih aman diarsipkan atau dibatalkan dengan alasan daripada dihapus permanen.
- WhatsApp tetap manual melalui handoff seperti `wa.me` atau WhatsApp Web. Jangan otomatisasi browser WhatsApp.
- Laporan resmi harus membaca payroll final aktif, bukan data sementara atau file PDF semata.
- Jangan menambah VPS, PostgreSQL, object storage, atau sync online kecuali kebutuhan produk benar-benar sudah jelas dan diminta eksplisit.

## Simple Desktop + Portal Employees Mode

HRIS tetap berjalan sebagai aplikasi desktop lokal untuk admin payroll. Kebutuhan owner dipenuhi melalui HRIS Portal Employees, bukan melalui aplikasi desktop.

Arsitektur target saat ini:

- Admin Payroll: aplikasi desktop Tauri.
- Owner/Manajemen: login ke HRIS Portal Employees di `karyawan.permatamedikaplg.com`.
- Portal employees: akses karyawan/ESS, publish slip, laporan ringkas owner, dan backup yang memang dipublikasikan.
- Database: SQLite lokal di OS app data directory.
- File storage: file lokal untuk slip PDF, export laporan, dan backup lokal.
- Deployment: satu PC/laptop utama untuk operasional payroll desktop.

Aturan role:

- Admin Payroll boleh mengelola master data, absensi, payroll, slip PDF, portal employees, user, dan backup/restore dari desktop.
- Owner tidak menjadi operator desktop.
- Owner boleh melihat laporan, slip, dan backup yang dipublikasikan melalui Portal Employees sesuai role owner/manajemen.
- Owner tidak boleh restore database.
- Viewer hanya untuk dashboard dasar.

Backup adalah data sensitif. Jika backup perlu diunduh owner, sediakan dari Portal Employees sebagai file yang dipublikasikan/diizinkan, bukan dengan membuka menu Backup desktop untuk owner.

### Deployment Modes

1. Simple Desktop + Portal Employees Mode.
   - Mode target saat ini.
   - Desktop lokal dipakai admin payroll.
   - SQLite lokal adalah source of truth.
   - Owner melihat laporan dan data yang dibutuhkan dari Portal Employees.
   - Tidak perlu VPS untuk kebutuhan ini.

2. Portal Employees Mode.
   - Portal untuk karyawan/ESS, owner/manajemen, laporan ringkas, slip, dan backup yang dipublikasikan.
   - Internet boleh dibutuhkan untuk publish/akses karyawan.
   - Tidak menjadi source of truth payroll utama.

3. Future Online Multi-Device Mode.
   - Hanya dipertimbangkan jika benar-benar diperlukan.
   - Desktop atau web client membaca/menulis ke backend API.
   - Database utama berada di VPS/PostgreSQL.
   - Membutuhkan desain auth, sync/no-sync decision, backup, audit, dan migration yang matang.

### VPS, PostgreSQL, dan Object Storage

Untuk tahap sekarang, jangan gunakan VPS + PostgreSQL sebagai arah utama karena kebutuhan owner bisa dipenuhi dari Portal Employees yang sudah ada.

Jika suatu saat kebutuhan berubah menjadi multi-laptop aktif, kerja dari luar klinik untuk admin payroll, atau portal perlu menjadi source of truth operasional, baru pertimbangkan:

- VPS menjalankan backend API.
- PostgreSQL menyimpan data utama.
- Object storage private menyimpan payslip PDF, export laporan, attachment, dan backup terenkripsi.
- Desktop tidak boleh connect langsung ke PostgreSQL; desktop harus lewat HTTPS API.

Object storage tetap bukan database aplikasi. Object storage hanya untuk file, bukan transaksi payroll, locking periode, audit revisi, query laporan, atau login.

### Future Migration Direction

Jika nanti benar-benar pindah ke online multi-device, lakukan bertahap:

1. Backend/API/auth architecture dan schema planning.
2. Online auth menggantikan local SQLite auth.
3. Master data via API.
4. Attendance via API.
5. Payroll finalization, snapshots, payslip PDFs, dan reports via API.
6. Owner web portal bila masih dibutuhkan.

Jangan melakukan big-bang migration tanpa rencana rollback, backup, dan validasi data.

## Alur Standar Payroll Bulanan

1. Master data disiapkan.
   - Data perusahaan dan bendahara.
   - Karyawan aktif, NIK, NPWP, jabatan, nomor WhatsApp, email jika dipakai.
   - Jadwal kerja, shift, kode absensi, aturan lembur, dan komponen payroll.

2. Periode absensi dibuat.
   - Admin membuat periode absensi sesuai periode payroll.
   - Periode tidak boleh tumpang tindih dengan periode lain.
   - Periode yang sudah masuk payroll final tidak boleh diubah.

3. Absensi diimpor.
   - Import fingerprint atau Excel disimpan sebagai raw import batch.
   - Data mentah import harus tetap bisa diaudit.
   - Import tidak boleh menimpa data absensi yang sudah ada untuk karyawan dan tanggal yang sama tanpa proses koreksi eksplisit.
   - Import ditolak bila tanggal sudah masuk payroll final.

4. Absensi direview.
   - Admin melihat exception: karyawan tidak dikenal, tanggal kosong, jam tidak valid, lupa absen, absen ganda, terlambat, pulang cepat, lembur, sakit, izin, cuti, dan alpa.
   - Koreksi manual disimpan sebagai adjustment, bukan menghilangkan jejak import awal.
   - Hasil akhir absensi per karyawan per tanggal menjadi dasar payroll.

5. Absensi dikunci.
   - Setelah exception selesai, periode absensi dikunci.
   - Setelah payroll final, absensi dalam periode tersebut wajib terkunci.
   - Unlock hanya boleh melalui proses koreksi/revisi yang jelas.

6. Draft payroll dibuat.
   - Draft payroll membaca snapshot karyawan, snapshot absensi, dan komponen payroll pada saat draft dibuat.
   - Draft boleh diedit, disimpan, dan diganti selama belum final.
   - Draft payroll tidak boleh mengubah data absensi final secara langsung.

7. Payroll direview.
   - Admin memeriksa total pendapatan, total potongan, gaji bersih, absensi, lembur, kasbon, BPJS, PPh21, dan terbilang.
   - Sistem harus menampilkan ringkasan validasi sebelum finalisasi.

8. Payroll difinalisasi.
   - Finalisasi membuat payroll run final dan snapshot slip.
   - Snapshot final harus menyimpan data karyawan, periode, komponen pendapatan, potongan, total, terbilang, perusahaan, dan bendahara.
   - Setelah final, data tidak boleh diubah langsung.

9. Slip PDF dibuat.
   - Slip PDF dibuat dari snapshot payroll final, bukan live master data.
   - File PDF harus memakai path atau nama file unik berdasarkan payroll run/revisi agar tidak menimpa slip lama.
   - Jika PDF dibuat ulang dari snapshot yang sama, sistem boleh mengganti file untuk snapshot yang sama setelah konfirmasi.
   - Jika payroll direvisi, PDF revisi harus berada di run/revisi baru.

10. Slip didistribusikan.
    - Status pengiriman dicatat per karyawan.
    - WhatsApp tetap manual: belum dibuka, dibuka, dikirim manual, gagal, nomor kosong.
   - WhatsApp handoff tetap manual.
   - Email atau portal ESS bersifat tambahan. Jangan membuat alur inti bergantung internet.

11. Laporan dibuat.
    - Laporan resmi membaca payroll final aktif.
    - Laporan harus tetap stabil walaupun master data karyawan berubah setelah periode selesai.

12. Backup dilakukan.
    - Backup lokal disarankan sebelum restore, migrasi, destructive operation, dan perubahan besar payroll.
    - Jika owner perlu download backup, backup harus dipublikasikan melalui Portal Employees dengan role owner/manajemen.
    - Restore wajib membuat safety backup sebelum mengganti database aktif.

## Status dan Locking

Gunakan status eksplisit agar data tidak berubah tanpa jejak.

### Absensi

- `draft`: periode dibuat, masih boleh diedit.
- `imported`: data import sudah masuk, masih perlu review.
- `reviewed`: exception sudah diselesaikan, siap payroll.
- `locked`: periode terkunci dan siap dipakai payroll.
- `payroll_finalized`: periode sudah dipakai payroll final dan tidak boleh diubah langsung.

Aturan:

- Import baru boleh masuk ke periode `draft` atau `imported`.
- Koreksi manual boleh dilakukan sampai `reviewed`.
- Payroll final mengunci absensi periode tersebut.
- Koreksi setelah payroll final harus melalui revisi payroll.

### Payroll

- `draft`: belum final, boleh diubah.
- `finalized`: sudah final dan menjadi sumber slip/laporan.
- `superseded`: final lama yang digantikan oleh revisi baru.
- `voided`: payroll final dibatalkan karena salah proses, dengan alasan.

Aturan:

- Satu periode boleh punya beberapa payroll run historis, tetapi hanya satu final aktif.
- Finalisasi periode yang sama tidak boleh overwrite diam-diam.
- Jika periode yang sama sudah final, sistem harus menawarkan proses revisi, bukan reset data lama.
- Revisi baru mengambil nomor revisi berikutnya, misalnya `v2`.
- Payroll `superseded` dan `voided` tetap tersimpan untuk audit.

### Slip PDF

- `not_generated`: snapshot ada, PDF belum dibuat.
- `pdf_ready`: PDF berhasil dibuat.
- `archived`: slip disimpan untuk histori, tidak aktif untuk distribusi utama.
- `voided`: slip dibatalkan karena payroll/slip salah, dengan alasan.

Aturan:

- Slip final tidak boleh hard delete secara default.
- Slip draft/import yang belum final boleh dihapus dengan konfirmasi.
- Slip final yang salah harus `voided` atau digantikan oleh slip revisi.
- Path PDF harus unik per payroll run/revisi, misalnya:

```text
payslips/payroll-run-2026-05-v1/NIK-nama.pdf
payslips/payroll-run-2026-05-v2/NIK-nama.pdf
```

## Absensi: Model Proses Yang Disarankan

Absensi produksi sebaiknya dipisah menjadi empat lapisan:

1. Raw import batch.
   - Nama file, sheet, waktu import, actor, jumlah baris, dan raw payload.
   - Tidak diubah setelah tersimpan.

2. Import rows.
   - Baris hasil parsing import.
   - Menyimpan status valid, error, atau karyawan tidak dikenal.

3. Attendance daily result.
   - Satu hasil akhir per karyawan per tanggal.
   - Berisi status, jam masuk, jam pulang, menit terlambat, menit pulang cepat, menit lembur, dan sumber.

4. Manual adjustment.
   - Koreksi admin untuk izin, sakit, cuti, lembur, lupa absen, alpa, atau catatan lain.
   - Menyimpan actor, waktu, alasan, nilai sebelum, dan nilai sesudah jika memungkinkan.

Absensi yang umum dibutuhkan klinik:

- Hadir.
- Sakit.
- Izin.
- Cuti.
- Alpa.
- Off/libur.
- Terlambat.
- Pulang cepat.
- Lembur hari kerja.
- Lembur hari libur.

## Payroll: Model Proses Yang Disarankan

Payroll harus deterministic dan berbasis snapshot.

Data input payroll:

- Karyawan aktif pada periode payroll.
- Snapshot gaji dan komponen payroll.
- Rekap absensi terkunci.
- Manual input tambahan seperti jasa tindakan, kasbon, potongan khusus, koreksi, atau bonus.

Komponen pendapatan standar:

- Gaji Pokok.
- Tunjangan Kinerja.
- Tunjangan Tidak Tetap.
- Jasa Tindakan.
- Uang Makan.
- Lembur.

Komponen potongan standar:

- Pajak PPh21.
- BPJS Kesehatan.
- BPJS TK.
- Potongan Kasbon.
- Potongan Absen.
- Potongan Terlambat.

Validasi sebelum finalisasi:

- Periode lengkap dan tidak kosong.
- Minimal satu karyawan.
- Tidak ada duplikat karyawan dalam satu payroll run.
- Semua komponen wajib ada.
- Nominal tidak negatif kecuali ada aturan khusus yang eksplisit.
- Total pendapatan sama dengan jumlah komponen pendapatan.
- Total potongan sama dengan jumlah komponen potongan.
- Gaji bersih sama dengan pendapatan dikurangi potongan.
- Terbilang tidak kosong.
- Master perusahaan dan bendahara lengkap.

## Revisi Payroll

Revisi adalah jawaban standar untuk koreksi setelah payroll final.

Contoh alasan revisi:

- Ada absensi terlambat yang belum masuk.
- Ada lembur yang salah hitung.
- Ada karyawan yang seharusnya tidak ikut payroll.
- Ada potongan kasbon yang salah.
- Ada data NPWP atau jabatan yang perlu benar di slip periode tersebut.

Alur revisi:

1. Admin memilih payroll final.
2. Admin klik `Buat Revisi`.
3. Sistem membuat draft revisi berdasarkan snapshot final terakhir.
4. Admin mengubah data yang perlu dikoreksi.
5. Admin mengisi alasan revisi.
6. Admin finalisasi revisi.
7. Sistem menandai final sebelumnya sebagai `superseded`.
8. Sistem membuat snapshot dan PDF revisi baru.
9. Laporan resmi membaca revisi aktif terbaru.

Yang tidak boleh:

- Menghapus payroll final lama tanpa jejak.
- Mengubah snapshot final lama secara langsung.
- Menimpa PDF final lama dengan isi revisi baru.

## Hapus, Arsip, dan Batal

Gunakan istilah dan perilaku yang berbeda:

- Hapus: hanya untuk draft atau import yang belum final.
- Arsipkan: menyembunyikan dari alur utama, tetapi data tetap ada.
- Batalkan/Void: menyatakan data final tidak berlaku, wajib ada alasan.

Aturan rekomendasi:

- Draft payroll boleh dihapus.
- Import batch boleh dihapus hanya bila belum dipakai payroll final.
- Payroll final tidak boleh dihapus dari UI normal.
- Slip final tidak boleh dihapus dari UI normal.
- File PDF final tidak boleh dihapus otomatis ketika payroll direvisi.
- Jika file PDF hilang dari disk, database tetap menyimpan snapshot dan sistem bisa membuat ulang PDF dari snapshot final.

## Laporan

Laporan harus menjawab kebutuhan operasional admin payroll, bukan hanya menampilkan slip.

Laporan minimum:

- Rekap payroll per periode.
- Daftar transfer gaji.
- Rekap komponen pendapatan.
- Rekap komponen potongan.
- Rekap absensi per karyawan.
- Rekap terlambat dan pulang cepat.
- Rekap lembur.
- Rekap BPJS dan PPh21.
- Rekap kasbon/potongan khusus.
- Status pembuatan dan pengiriman slip.
- Riwayat revisi payroll.

Aturan laporan:

- Laporan resmi membaca payroll final aktif.
- Laporan historis dapat menampilkan payroll `superseded` atau `voided` sebagai audit, tetapi harus diberi label jelas.
- Angka laporan tidak boleh berubah karena master data karyawan diperbarui setelah finalisasi.
- Export laporan boleh ditambahkan bertahap, misalnya CSV/XLSX/PDF, tetapi tidak boleh mengubah sumber data resmi.

## Agent Implementation Notes

Saat agent mengerjakan fitur terkait dokumen ini:

- Baca dokumen ini sebelum mengubah auth, database, absensi, payroll, slip PDF, laporan, backup, atau portal.
- Target produk saat ini adalah Simple Desktop + Portal Employees Mode: desktop lokal untuk Admin Payroll, Portal Employees untuk owner/karyawan.
- Jangan menambah VPS/PostgreSQL/object storage/sync online kecuali diminta eksplisit.
- Owner tidak memakai desktop sebagai operator. Owner melihat laporan, slip, dan backup yang dipublikasikan lewat Portal Employees.
- Owner tidak boleh restore database.
- Jangan membuat finalisasi periode yang sama melakukan overwrite diam-diam.
- Jangan menghapus data final tanpa status audit seperti `superseded`, `archived`, atau `voided`.
- Jaga agar payroll final, slip PDF, dan laporan memakai snapshot.
- Simpan raw import dan manual adjustment dengan jejak actor/waktu/alasan bila fitur koreksi disentuh.
- Jaga SQLite tetap lokal dan jangan share file SQLite aktif ke network folder.
- Untuk perubahan schema, gunakan migration dan pertimbangkan backup/restore impact.
