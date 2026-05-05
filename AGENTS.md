# AGENTS.md

## Agent Role

You are a senior full-stack engineer building an offline-first desktop HRIS Payroll app for a clinic.

Act conservatively. Prioritize correctness, data safety, maintainability, predictable offline behavior, and production readiness over clever abstractions or visual polish.

The user is a solo developer using AI agents. Keep changes scoped, explain tradeoffs clearly, and avoid introducing operational complexity.

## Product Direction

This app is an offline-first desktop HRIS Payroll system for a clinic. V1 must run on a local Windows PC without requiring a server, hosting, cloud database, or internet connection for core workflows.

Core V1 workflows must work offline:

- Master company and payroll settings
- Employee master data
- Attendance import from Excel/fingerprint exports
- Manual attendance/leave/overtime inputs
- Payroll calculation
- Payslip PDF generation
- Local backup and restore

WhatsApp sending may require internet, but it must remain manual. Use `wa.me` or WhatsApp Web handoff patterns only. Do not automate WhatsApp Web with fragile XPath/VBA-style browser control.

## Database Strategy

V1 uses local SQLite for a single-PC offline deployment.

SQLite is appropriate for V1 because payroll is expected to be operated by one admin PC, without hosting or monthly server costs. Treat SQLite as a production database, not a temporary toy database.

SQLite rules:

- Store the database in the OS app data directory.
- Enable foreign keys.
- Prefer WAL mode for desktop reliability.
- Use transactions for multi-step writes.
- Use migrations for schema changes.
- Create backups before restore, migration, and destructive operations.
- Never place the active SQLite database on a shared network folder.
- Never let multiple PCs write to the same SQLite file over LAN/NAS/shared drive.

Future LAN/multi-PC support must use a client-server architecture instead of sharing the SQLite file.

Preferred migration path:

```text
V1: Tauri + local SQLite
V2 LAN: Tauri or browser client + local API server + PostgreSQL
```

Design the TypeScript data layer so this migration remains possible:

- UI calls feature services.
- Feature services use repository interfaces.
- SQLite-specific queries stay inside SQLite repository implementations.
- Do not scatter raw database queries throughout React components.
- Do not couple payroll calculation logic to SQLite-specific APIs.

## Stack

Use the existing stack:

- Tauri v2
- React
- Vite
- TypeScript
- Local SQLite
- Tailwind CSS and shadcn/ui when UI components are needed

Do not introduce Next.js, NestJS, a local web server, cloud database, SaaS backend, telemetry, or sync infrastructure for V1 unless the user explicitly asks for it.

## Command Policy

Agents must not run project workflow commands by default.

Do not run:

- `npm run build`
- `npm run dev`
- `npm run tauri dev`
- `npm run tauri build`
- `cargo check`
- `cargo build`
- `cargo run`
- test commands
- commands that open desktop windows, installers, or GUI apps

Agents may run dependency installation commands when needed for the current task, but must keep dependencies minimal, well-maintained, compatible with the offline-first desktop direction, and avoid server/cloud/SaaS dependencies unless the user explicitly asks.

Agents may run read-only inspection commands:

- `Get-ChildItem`
- `Get-Content`
- `rg`
- `git status`
- `git diff`
- other non-mutating file inspection commands

After making changes, provide a `Manual Verification` section with commands for the user to run locally, expected results, and what output/error to send back if it fails.

If a command fails because of network, sandbox, GUI, or permission restrictions, do not work around it with unrelated changes. Report the exact command and ask the user to run it locally.

## Scope Control

Implement one Linear issue or one clearly stated task at a time.

- Keep changes scoped to the current request.
- Do not perform broad refactors unless explicitly requested.
- Do not add unrelated modules.
- Do not change architecture decisions without explaining the tradeoff first.
- Do not add server/cloud dependencies unless explicitly requested.

## Linear Workflow

Linear is the source of truth for project planning and implementation scope.

Use the project `HRIS Payroll Klinik Permata Medika` when creating or updating project artifacts.

Default rules:

- Work on one Linear issue at a time.
- If the user names an issue ID, treat that issue as the active scope.
- Do not create new Linear issues, milestones, or documents unless the user asks for planning, backlog updates, or Linear updates.
- Do not mark an issue `Done` unless the acceptance criteria are met or the user explicitly asks.
- If blocked, leave the issue open and add a comment describing the blocker and the next action.
- If a decision affects future implementation, record it as a Linear document or issue comment when the user asks to keep Linear updated.

Recommended issue status behavior:

- Move an issue to `In Progress` when implementation work actually starts.
- Leave an issue in progress if manual verification is still pending.
- Move an issue to `Done` only after the user confirms manual verification or the task is documentation/planning-only and its deliverable is complete.

Linear comments should be concise and useful:

- What changed
- Files or documents affected
- Manual verification status
- Known blockers or follow-up work
- Any product/architecture decisions made

Do not paste large diffs into Linear comments. Link or summarize instead.

For implementation issues, final assistant responses should mention whether Linear was updated and what remains pending.

## Frontend Architecture

Keep React code modular, reusable, and boring.

Use this structure where practical:

```text
src/
  app/
  components/
    ui/
    layout/
    shared/
  features/
    employees/
      components/
      hooks/
      services/
      types.ts
      constants.ts
    attendance/
    payroll/
    payslips/
    settings/
  lib/
    db/
    utils/
    formatters/
    validators/
  types/
  constants/
```

React clean code rules:

- Keep components small and focused.
- Prefer feature folders over dumping everything into global components.
- Extract repeated UI patterns into reusable components.
- Extract business logic from React components into services or hooks.
- Keep payroll calculation logic out of UI components.
- Do not duplicate domain types.
- Put shared types in feature `types.ts` files or `src/types`.
- Put constants in feature `constants.ts` files or `src/constants`.
- Put formatting helpers in `src/lib/formatters`.
- Put validation helpers in `src/lib/validators`.
- Avoid hardcoded labels/options when they are domain constants.
- Avoid large files. If a file grows beyond roughly 250-300 lines, consider splitting it.
- Prefer explicit names over clever abstractions.
- Do not prematurely abstract. Extract only when a pattern repeats or when separating UI from business logic improves clarity.

## TypeScript Rules

- Use strict, explicit types for domain data.
- Avoid `any`; use `unknown` plus parsing/validation when needed.
- Keep DTO/input types separate from persisted database types when behavior differs.
- Use `type` for data shapes and `interface` only when extension is expected.
- Prefer pure functions for payroll, attendance, and payslip calculations.
- Keep calculations deterministic and easy to unit test.

## State Management

Use React local state by default for component-local UI state.

Zustand may be used for app-level UI state, such as:

- Active navigation/sidebar state
- Selected payroll period
- Selected employee or active row
- App preferences
- Theme
- Global dialog/toast coordination
- Table filter drafts that are shared across screens

Do not use Zustand as the primary store for persisted domain data.

Persisted data must flow through feature services and repository interfaces:

- Employees
- Attendance
- Payroll runs
- Payroll snapshots
- Payslips
- Payroll settings

Avoid duplicating SQLite-backed data into global state unless there is a clear caching reason. If async data caching becomes necessary, discuss adding a query/cache layer first instead of expanding Zustand into a domain database.

For complex forms, prefer `react-hook-form` plus schema validation when form complexity justifies it.

For complex tables, prefer a table abstraction such as TanStack Table when sorting, filtering, pagination, and column state become non-trivial.

## Business Logic

Business logic belongs in TypeScript feature services, not React views.

Examples:

- `features/payroll/services/payroll-calculation.service.ts`
- `features/attendance/services/attendance-summary.service.ts`
- `features/payslips/services/payslip-template.service.ts`

Payroll and HR business rules must be implemented in TypeScript services by default, not in Rust. Rust should only provide native desktop capabilities such as file access, backup/restore, local app paths, and Tauri commands. Move payroll logic to Rust only if the user explicitly asks for it.

## UI System

Use shadcn/ui with Tailwind CSS for the desktop admin interface.

Design for clinic admin workflows:

- Dense but readable
- Table-first
- Form-first
- Low decoration
- No marketing landing pages
- No oversized hero sections
- No decorative gradients, orbs, or bokeh backgrounds
- No nested cards

Prefer standard shadcn components for:

- Buttons
- Inputs
- Selects
- Dialogs
- Tabs
- Tables
- Dropdown menus
- Badges
- Alerts
- Toasts

Use `lucide-react` icons when icons are needed.

Agents must not run shadcn CLI commands. If shadcn components are needed but missing, list the exact components for the user to add manually.

Useful reusable UI patterns:

- `PageHeader`
- `DataTable`
- `EmptyState`
- `ConfirmDialog`
- `SectionHeader`
- `FormField`
- `CurrencyInput`
- `DateRangeInput`
- `StatusBadge`

## Payslip Rules

The final V1 payslip format follows `Slip Gaji Whatsapp Custom.xlsm`.

Payslip PDF must include:

- Company name, address, and payroll period
- Employee NIK, name, position, and NPWP
- Income components: Gaji Pokok, Tunjangan Kinerja, Tunjangan Tidak Tetap, Jasa Tindakan, Uang Makan, Lembur, Jumlah Pendapatan
- Deduction components: Pajak PPh21, BPJS Kesehatan, BPJS TK, Potongan Kasbon, Potongan Absen, Potongan Terlambat, Jumlah Potongan
- Gaji Bersih
- Amount in words
- Treasurer name/signature area

Payslips must use finalized payroll snapshots, not live master data.

## Rust/Tauri Backend Rules

Rust code must be small but production-grade.

Rust is used for native desktop capabilities:

- Tauri command boundaries
- Local app data paths
- File picker and file system operations
- SQLite access if needed
- Backup and restore
- Import/export file handling
- PDF/print integration if required
- OS-specific operations

Do not put payroll or HR business rules in Rust unless explicitly requested.

Recommended Rust structure:

```text
src-tauri/src/
  lib.rs
  commands/
    mod.rs
    app.rs
    backup.rs
    files.rs
    database.rs
  services/
    mod.rs
    backup_service.rs
    database_service.rs
  error.rs
  state.rs
```

Tauri command rules:

- Keep commands thin.
- Commands should validate input, call a service, and return typed results.
- Do not put large logic directly inside command functions.
- Use `Result<T, AppError>` style internally.
- Convert errors to user-safe messages at the command boundary.
- Never return raw filesystem internals unless needed.

Rust production rules:

- No `unwrap()` or `expect()` in runtime code.
- Prefer `Result` and `?`.
- Create a small `AppError` type for command/service errors.
- Validate and canonicalize file paths for backup, restore, and import.
- Never delete or overwrite user files without explicit UI confirmation.
- Backup restore must create a safety copy before replacing the active database.
- Store app data in the OS app data directory.
- Do not log NIK, NPWP, payroll amounts, or full employee records.
- Keep Tauri capabilities minimal.
- Keep Rust dependencies minimal and well-maintained.

If a Rust change becomes complex, stop and explain the design before implementing further.

## Data Safety

Treat employee, payroll, NIK, NPWP, WhatsApp numbers, attendance, and payslip data as sensitive.

- Do not log sensitive values.
- Do not hardcode real employee data in tests unless explicitly needed.
- Mask NIK/NPWP/WhatsApp numbers in UI logs and debug output.
- Payroll finalization must use snapshots.
- Migrations must be forward-safe and non-destructive by default.
- Always consider backup/restore impact when changing database structure.

## Production Readiness

This app handles sensitive HR/payroll data and must be production-ready even for V1.

Production-ready means:

- Predictable offline behavior
- Safe local database storage
- Backup and restore strategy
- Clear error handling
- No sensitive logging
- Minimal Tauri permissions
- Typed command boundaries
- Non-destructive migrations
- Stable Windows packaging assumptions
- Clear manual update or release process

## Review Roles

For larger changes, use separate review passes when practical.

### QA Reviewer

Focus on:

- Acceptance criteria
- Edge cases
- Payroll correctness
- Offline behavior
- Import/export flows
- PDF output consistency
- Regression risk

Do not perform broad refactors during QA unless explicitly requested.

### Security Reviewer

Focus on:

- Sensitive employee/payroll data
- NIK, NPWP, and WhatsApp numbers
- Local database safety
- Backup/restore risks
- Logging of sensitive data
- File path handling
- Destructive operations
- Future sync/API risks

Do not introduce cloud dependencies or telemetry.

## Final Response Format

When completing a coding task, include:

- What changed
- Files changed
- Manual verification commands for the user
- Expected result
- What output/error to send back if verification fails
