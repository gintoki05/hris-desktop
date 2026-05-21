# AGENTS.md

## Agent Role

You are a senior full-stack engineer building a local desktop HRIS Payroll app for a clinic.

Act conservatively. Prioritize correctness, data safety, maintainability, predictable local desktop behavior, and production readiness over clever abstractions or visual polish.

The user is a solo developer using AI agents. Keep changes scoped, explain tradeoffs clearly, and avoid introducing operational complexity.

## Product Direction

This app is a local desktop HRIS Payroll system for a clinic, paired with HRIS Portal Employees at `karyawan.permatamedikaplg.com`. The current product direction is Simple Desktop + Portal Employees Mode: desktop for Admin Payroll operations, portal for owner/management and employee access.

For product/business process decisions around auth, database, attendance, payroll finalization, payslip revisions, deletion/archive behavior, reports, backup access, portal employees, owner access, and future online mode, read `docs/product-business-process.md` first and use it as the source of truth before making implementation changes.

Target architecture:

- Admin Payroll uses the Tauri desktop app for operational work.
- Owner/Management uses HRIS Portal Employees, not the desktop app, for reports and management visibility.
- Portal Employees / ESS is the internet-facing access path for employees and owner/management.
- Local SQLite is the source of truth for the desktop app.
- Backup files are local files controlled from the desktop app.
- Do not add VPS, PostgreSQL, object storage, or sync infrastructure unless the user explicitly asks for online multi-device mode.

Core workflows must work in the local desktop app:

- Master company and payroll settings
- Employee master data
- Attendance import from Excel/fingerprint exports
- Manual attendance/leave/overtime inputs
- Payroll calculation
- Payslip PDF generation
- Local backup and restore

WhatsApp sending may require internet, but it must remain manual. Use `wa.me` or WhatsApp Web handoff patterns only. Do not automate WhatsApp Web with fragile XPath/VBA-style browser control.

## Database Strategy

Use local SQLite for the current single-PC desktop deployment.

SQLite is appropriate because payroll is expected to be operated by one admin PC, without hosting or monthly server costs. Treat SQLite as a production database, not a temporary toy database.

SQLite rules:

- Store the database in the OS app data directory.
- Enable foreign keys.
- Prefer WAL mode for desktop reliability.
- Use transactions for multi-step writes.
- Use migrations for schema changes.
- Create backups before restore, migration, and destructive operations.
- Never place the active SQLite database on a shared network folder.
- Never let multiple PCs write to the same SQLite file over LAN/NAS/shared drive.

Future LAN/multi-PC/internet support must use a client-server architecture instead of sharing the SQLite file.

Possible future migration path if explicitly requested:

```text
Current: Tauri + local SQLite + role-based desktop access
Future online: Tauri or browser client + backend API + PostgreSQL
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

Do not introduce Next.js, NestJS, a local web server, cloud database, SaaS backend, telemetry, VPS/PostgreSQL, object storage, or sync infrastructure unless the user explicitly asks for it.

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

Exception for app update work:

When the user explicitly asks to implement, package, publish, or test the in-app updater, agents may run the minimum required non-build commands for that updater workflow:

- read-only inspection of generated bundle artifacts
- copying generated updater artifacts into a local release folder
- `npx wrangler pages deploy ...` to publish updater files to Cloudflare Pages

Agents must not run desktop build or signing commands for updater packaging. The user runs these locally:

- `npm run build`
- `npm run tauri build`
- Tauri signer commands
- commands that create or sign installer/update artifacts

Keep this exception scoped to update packaging and verification only. Do not use it as permission for unrelated app-wide builds, dev servers, desktop window launches, installers, GUI apps, or broad deployment work. Before deploying to Cloudflare Pages, verify the target project/branch/path and avoid replacing unrelated portal content with an update-only folder.

Agents may run dependency installation commands when needed for the current task, but must keep dependencies minimal, well-maintained, compatible with the local desktop direction, and avoid server/cloud/SaaS dependencies unless the user explicitly asks.

Agents may set up frontend UI tooling when the user explicitly asks for it, including Tailwind CSS and shadcn/ui dependencies/configuration for this Vite React Tauri app. Keep setup scoped to UI tooling and required local config files. Do not use UI setup as a reason to introduce a server framework, cloud service, telemetry, or app-wide redesign.

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

For new or touched UI work, use shadcn/ui components by default instead of adding new ad hoc custom CSS controls. Prefer existing components in `src/components/ui` and add missing shadcn components when the current task needs them. Keep feature-specific layout CSS small and only for composition that shadcn components do not cover.

If shadcn/ui is not yet installed, agents may implement the manual shadcn/ui setup when the user asks for it:

- Install only the dependencies required for Tailwind CSS, shadcn/ui, and the specific components being added.
- Add or update `components.json`, Tailwind/global CSS, import aliases, and `src/lib/utils.ts` as needed.
- Prefer Vite/React-compatible setup; do not add Next.js or React Server Components.
- Migrate UI incrementally, one screen or component group at a time.
- Keep existing custom CSS working during transition; remove custom CSS only when the replacement is verified.
- When editing an existing screen, migrate the touched controls toward shadcn/ui incrementally instead of mixing another custom button/input/dialog pattern into the same area.

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

Agents may run shadcn CLI commands only when the user explicitly asks to install or add shadcn/ui components. Prefer manual installation/configuration for initial setup when it is clearer and safer. Do not run broad shadcn commands that overwrite unrelated UI files. If a shadcn command fails due to network or permissions, report the exact command and ask the user to run it locally.

Useful reusable UI patterns:

- `PageHeader`
- `DataTable`
- `Pagination`
- `EmptyState`
- `ConfirmDialog`
- `SectionHeader`
- `FormField`
- `CurrencyInput`
- `DateRangeInput`
- `StatusBadge`

Table and pagination rules:

- Any table that can grow beyond one screen of rows must provide pagination or another explicit row-limiting pattern.
- Prefer a reusable pagination component/pattern shared from `src/components/shared` or `src/components/ui` instead of building ad hoc pagination inside each feature.
- Pagination state may stay local to the table component unless filters/page state must be shared across screens.
- Keep pagination controls predictable: previous/next, current page, total pages or total rows, and a clear disabled state at boundaries.
- If a table later needs non-trivial sorting, filtering, column state, and pagination together, consider a table abstraction such as TanStack Table before adding more custom table logic.

## Payslip Rules

The final payslip format follows `Slip Gaji Whatsapp Custom.xlsm`.

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

This app handles sensitive HR/payroll data and must be production-ready.

Production-ready means:

- Predictable local desktop behavior
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
