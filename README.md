# HRIS Payroll Klinik

Desktop HRIS Payroll app for a single clinic admin PC.

## V1 Direction

- Tauri v2 desktop app with React, Vite, and TypeScript.
- Core workflows must run offline without a server, hosting, cloud database, or internet.
- Local SQLite database is stored in the OS app data directory.
- SQLite is configured with foreign keys and WAL mode.
- UI code calls feature services. Feature services depend on repository interfaces.
- SQLite and Tauri details stay behind repository implementations and Tauri commands.
- WhatsApp delivery is manual only through `wa.me` or WhatsApp Web handoff patterns.

## Local Foundation

The app initializes `hris-payroll.sqlite3` in the app data directory when the desktop app starts.
The initial migration creates foundation tables for:

- Company settings
- Employees
- Attendance imports and entries
- Payroll runs
- Finalized payslip snapshots
- Local backup events

Backup files are created under the app data backup directory. Restore support is exposed through a
Tauri command and creates a safety backup before replacing the active database.

## Manual Verification

Agents must not run workflow commands automatically. Run these locally when verifying changes:

```powershell
npm run build
npm run tauri dev
```

Expected result:

- TypeScript and Vite build succeed.
- The desktop app opens to the HRIS Payroll admin shell.
- The status panel shows SQLite ready, WAL journal mode, foreign keys active, and one migration
  applied.

If verification fails, send back the full command output for the failing command.
