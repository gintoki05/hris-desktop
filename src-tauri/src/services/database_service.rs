use std::{
    fs,
    path::{Path, PathBuf},
};

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use crate::{
    error::AppError,
    services::backup_service,
    state::{BACKUP_DIRECTORY_NAME, DATABASE_FILE_NAME},
};

pub struct DatabaseStatus {
    pub database_path: PathBuf,
    pub backup_directory: PathBuf,
    pub journal_mode: String,
    pub foreign_keys_enabled: bool,
    pub migrations_applied: u32,
}

struct Migration {
    id: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        id: "202605050001_foundation_schema",
        sql: "
        CREATE TABLE IF NOT EXISTS company_settings (
            id TEXT PRIMARY KEY,
            company_name TEXT NOT NULL,
            address TEXT NOT NULL,
            treasurer_name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY,
            nik TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            position TEXT NOT NULL,
            npwp TEXT,
            employment_type TEXT NOT NULL CHECK (employment_type IN ('monthly', 'daily')),
            shift_type TEXT NOT NULL CHECK (shift_type IN ('shift', 'non_shift')),
            status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS attendance_import_batches (
            id TEXT PRIMARY KEY,
            source_file_name TEXT NOT NULL,
            imported_at TEXT NOT NULL,
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS attendance_entries (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            import_batch_id TEXT,
            work_date TEXT NOT NULL,
            status TEXT NOT NULL,
            minutes_late INTEGER NOT NULL DEFAULT 0,
            minutes_early_leave INTEGER NOT NULL DEFAULT 0,
            overtime_minutes INTEGER NOT NULL DEFAULT 0,
            source TEXT NOT NULL CHECK (source IN ('import', 'manual')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id),
            FOREIGN KEY (import_batch_id) REFERENCES attendance_import_batches(id)
        );

        CREATE TABLE IF NOT EXISTS payroll_runs (
            id TEXT PRIMARY KEY,
            period_label TEXT NOT NULL,
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('draft', 'finalized')),
            finalized_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS payroll_payslip_snapshots (
            id TEXT PRIMARY KEY,
            payroll_run_id TEXT NOT NULL,
            employee_id TEXT NOT NULL,
            snapshot_json TEXT NOT NULL,
            net_pay INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id),
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        );

        CREATE TABLE IF NOT EXISTS local_backup_events (
            id TEXT PRIMARY KEY,
            backup_path TEXT NOT NULL,
            reason TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    ",
    },
    Migration {
        id: "202605050002_auth_schema",
        sql: "
        CREATE TABLE IF NOT EXISTS auth_roles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            role_id TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            password_algorithm TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
            last_login_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (role_id) REFERENCES auth_roles(id)
        );

        CREATE TABLE IF NOT EXISTS auth_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            FOREIGN KEY (user_id) REFERENCES auth_users(id)
        );

        INSERT OR IGNORE INTO auth_roles (id, name, description, created_at, updated_at)
        VALUES
            ('admin_payroll', 'Admin Payroll', 'Mengelola master data, absensi, payroll, slip, dan backup.', datetime('now'), datetime('now')),
            ('owner_management', 'Owner/Manajemen', 'Melihat dashboard, laporan, slip, dan ringkasan payroll.', datetime('now'), datetime('now')),
            ('viewer', 'Viewer', 'Melihat data terbatas tanpa aksi perubahan.', datetime('now'), datetime('now'));
    ",
    },
    Migration {
        id: "202605050003_master_settings_schema",
        sql: "
        ALTER TABLE company_settings ADD COLUMN contact_phone TEXT NOT NULL DEFAULT '';
        ALTER TABLE company_settings ADD COLUMN contact_email TEXT NOT NULL DEFAULT '';

        INSERT OR IGNORE INTO company_settings (
            id,
            company_name,
            address,
            treasurer_name,
            contact_phone,
            contact_email,
            created_at,
            updated_at
        )
        VALUES (
            'default',
            'Klinik Permata Medika',
            '',
            '',
            '',
            '',
            datetime('now'),
            datetime('now')
        );

        CREATE TABLE IF NOT EXISTS payroll_settings (
            id TEXT PRIMARY KEY,
            current_year INTEGER NOT NULL,
            payday_type TEXT NOT NULL CHECK (payday_type IN ('day_of_month', 'weekday')),
            payday_day_of_month INTEGER CHECK (
                payday_day_of_month IS NULL OR payday_day_of_month BETWEEN 1 AND 31
            ),
            payday_weekday TEXT CHECK (
                payday_weekday IS NULL
                OR payday_weekday IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
            ),
            working_days_per_week INTEGER NOT NULL CHECK (working_days_per_week BETWEEN 1 AND 7),
            late_tolerance_minutes INTEGER NOT NULL CHECK (late_tolerance_minutes >= 0),
            late_penalty_amount INTEGER NOT NULL CHECK (late_penalty_amount >= 0),
            early_leave_tolerance_minutes INTEGER NOT NULL CHECK (early_leave_tolerance_minutes >= 0),
            early_leave_penalty_amount INTEGER NOT NULL CHECK (early_leave_penalty_amount >= 0),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        INSERT OR IGNORE INTO payroll_settings (
            id,
            current_year,
            payday_type,
            payday_day_of_month,
            payday_weekday,
            working_days_per_week,
            late_tolerance_minutes,
            late_penalty_amount,
            early_leave_tolerance_minutes,
            early_leave_penalty_amount,
            created_at,
            updated_at
        )
        VALUES (
            'default',
            CAST(strftime('%Y', 'now') AS INTEGER),
            'day_of_month',
            25,
            NULL,
            6,
            0,
            0,
            0,
            0,
            datetime('now'),
            datetime('now')
        );

        CREATE TABLE IF NOT EXISTS settings_audit_events (
            id TEXT PRIMARY KEY,
            setting_scope TEXT NOT NULL CHECK (setting_scope IN ('company', 'payroll', 'master_settings')),
            actor_user_id TEXT NOT NULL,
            actor_display_name TEXT NOT NULL,
            actor_role TEXT NOT NULL,
            change_summary TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    ",
    },
    Migration {
        id: "202605070001_employee_master_fields",
        sql: "
        ALTER TABLE employees ADD COLUMN hire_date TEXT NOT NULL DEFAULT '';
        ALTER TABLE employees ADD COLUMN marital_status TEXT NOT NULL DEFAULT 'single';
        ALTER TABLE employees ADD COLUMN dependents INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE employees ADD COLUMN department TEXT NOT NULL DEFAULT '';
        ALTER TABLE employees ADD COLUMN salary_amount INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE employees ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash';
        ALTER TABLE employees ADD COLUMN pph21_enabled INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE employees ADD COLUMN work_schedule TEXT NOT NULL DEFAULT 'regular';

        CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
        CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
        CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
    ",
    },
    Migration {
        id: "202605070002_attendance_master_data",
        sql: "
        CREATE TABLE IF NOT EXISTS work_shifts (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
            is_off INTEGER NOT NULL DEFAULT 0 CHECK (is_off IN (0, 1)),
            is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS attendance_codes (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            category TEXT NOT NULL CHECK (category IN ('present', 'sick', 'leave', 'absence', 'off')),
            counts_as_workday INTEGER NOT NULL DEFAULT 1 CHECK (counts_as_workday IN (0, 1)),
            is_paid INTEGER NOT NULL DEFAULT 1 CHECK (is_paid IN (0, 1)),
            is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS overtime_rules (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            applies_to TEXT NOT NULL CHECK (applies_to IN ('workday', 'holiday')),
            multiplier REAL NOT NULL CHECK (multiplier >= 0),
            is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        INSERT OR IGNORE INTO work_shifts (
            id, code, name, start_time, end_time, break_minutes, is_off, is_active, sort_order, created_at, updated_at
        )
        VALUES
            ('shift-pagi', 'PAGI', 'Shift Pagi', '07:00', '14:00', 0, 0, 1, 10, datetime('now'), datetime('now')),
            ('shift-siang', 'SIANG', 'Shift Siang', '14:00', '21:00', 0, 0, 1, 20, datetime('now'), datetime('now')),
            ('shift-middle', 'MIDDLE', 'Shift Middle', '10:00', '17:00', 0, 0, 1, 30, datetime('now'), datetime('now')),
            ('shift-non-shift', 'NONSHIFT', 'Non-shift', '08:00', '16:00', 60, 0, 1, 40, datetime('now'), datetime('now')),
            ('shift-off', 'OFF', 'Off', '00:00', '00:00', 0, 1, 1, 50, datetime('now'), datetime('now'));

        INSERT OR IGNORE INTO attendance_codes (
            id, code, name, category, counts_as_workday, is_paid, is_active, sort_order, created_at, updated_at
        )
        VALUES
            ('attendance-present', 'H', 'Hadir', 'present', 1, 1, 1, 10, datetime('now'), datetime('now')),
            ('attendance-sick', 'S', 'Sakit', 'sick', 1, 1, 1, 20, datetime('now'), datetime('now')),
            ('attendance-permit', 'I', 'Izin', 'leave', 1, 1, 1, 30, datetime('now'), datetime('now')),
            ('attendance-leave', 'C', 'Cuti', 'leave', 1, 1, 1, 40, datetime('now'), datetime('now')),
            ('attendance-absence', 'A', 'Alpa', 'absence', 1, 0, 1, 50, datetime('now'), datetime('now')),
            ('attendance-off', 'OFF', 'Off', 'off', 0, 0, 1, 60, datetime('now'), datetime('now'));

        INSERT OR IGNORE INTO overtime_rules (
            id, code, name, applies_to, multiplier, is_active, sort_order, created_at, updated_at
        )
        VALUES
            ('overtime-workday', 'LEMBUR_HARIAN', 'Lembur Harian', 'workday', 1.5, 1, 10, datetime('now'), datetime('now')),
            ('overtime-holiday', 'LEMBUR_LIBUR', 'Lembur Hari Libur', 'holiday', 2.0, 1, 20, datetime('now'), datetime('now'));

        CREATE INDEX IF NOT EXISTS idx_work_shifts_active ON work_shifts(is_active);
        CREATE INDEX IF NOT EXISTS idx_attendance_codes_active ON attendance_codes(is_active);
        CREATE INDEX IF NOT EXISTS idx_overtime_rules_active ON overtime_rules(is_active);
    ",
    },
    Migration {
        id: "202605070003_employee_work_schedules",
        sql: "
        CREATE TABLE IF NOT EXISTS work_schedule_periods (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'locked')),
            locked_payroll_run_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (locked_payroll_run_id) REFERENCES payroll_runs(id)
        );

        CREATE TABLE IF NOT EXISTS employee_work_schedules (
            id TEXT PRIMARY KEY,
            period_id TEXT NOT NULL,
            employee_id TEXT NOT NULL,
            work_date TEXT NOT NULL,
            shift_id TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            locked_payroll_run_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (period_id) REFERENCES work_schedule_periods(id),
            FOREIGN KEY (employee_id) REFERENCES employees(id),
            FOREIGN KEY (shift_id) REFERENCES work_shifts(id),
            FOREIGN KEY (locked_payroll_run_id) REFERENCES payroll_runs(id),
            UNIQUE (period_id, employee_id, work_date)
        );

        CREATE INDEX IF NOT EXISTS idx_work_schedule_period_dates
            ON work_schedule_periods(start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_employee_work_schedules_period
            ON employee_work_schedules(period_id);
        CREATE INDEX IF NOT EXISTS idx_employee_work_schedules_employee_date
            ON employee_work_schedules(employee_id, work_date);
    ",
    },
    Migration {
        id: "202605070004_attendance_import_audit_rows",
        sql: "
        ALTER TABLE attendance_entries ADD COLUMN clock_in TEXT;
        ALTER TABLE attendance_entries ADD COLUMN clock_out TEXT;

        CREATE TABLE IF NOT EXISTS attendance_import_rows (
            id TEXT PRIMARY KEY,
            import_batch_id TEXT NOT NULL,
            source_row_number INTEGER NOT NULL,
            employee_id TEXT,
            employee_nik TEXT NOT NULL DEFAULT '',
            employee_name TEXT NOT NULL DEFAULT '',
            work_date TEXT NOT NULL,
            clock_in TEXT,
            clock_out TEXT,
            raw_payload_json TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('valid', 'error', 'unknown_employee')),
            error_message TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (import_batch_id) REFERENCES attendance_import_batches(id),
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_batch
            ON attendance_import_rows(import_batch_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_entries_employee_date
            ON attendance_entries(employee_id, work_date);
        CREATE INDEX IF NOT EXISTS idx_attendance_entries_import_batch
            ON attendance_entries(import_batch_id);
    ",
    },
    Migration {
        id: "202605080001_company_logo_setting",
        sql: "
        ALTER TABLE company_settings ADD COLUMN logo_data_url TEXT NOT NULL DEFAULT '';
    ",
    },
    Migration {
        id: "202605080002_organization_reference_master",
        sql: "
        CREATE TABLE IF NOT EXISTS departments (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS positions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        INSERT OR IGNORE INTO departments (id, name, is_active, sort_order, created_at, updated_at)
        VALUES
            ('department-poli-umum', 'Poli Umum', 1, 10, datetime('now'), datetime('now')),
            ('department-poli-gigi', 'Poli Gigi', 1, 20, datetime('now'), datetime('now')),
            ('department-farmasi', 'Farmasi', 1, 30, datetime('now'), datetime('now')),
            ('department-pendaftaran', 'Pendaftaran', 1, 40, datetime('now'), datetime('now')),
            ('department-kasir', 'Kasir', 1, 50, datetime('now'), datetime('now')),
            ('department-manajemen', 'Manajemen', 1, 60, datetime('now'), datetime('now'));

        INSERT OR IGNORE INTO positions (id, name, is_active, sort_order, created_at, updated_at)
        VALUES
            ('position-dokter', 'Dokter', 1, 10, datetime('now'), datetime('now')),
            ('position-perawat', 'Perawat', 1, 20, datetime('now'), datetime('now')),
            ('position-bidan', 'Bidan', 1, 30, datetime('now'), datetime('now')),
            ('position-apoteker', 'Apoteker', 1, 40, datetime('now'), datetime('now')),
            ('position-admin-pendaftaran', 'Admin Pendaftaran', 1, 50, datetime('now'), datetime('now')),
            ('position-kasir', 'Kasir', 1, 60, datetime('now'), datetime('now')),
            ('position-manajemen', 'Manajemen', 1, 70, datetime('now'), datetime('now'));

        INSERT OR IGNORE INTO departments (id, name, is_active, sort_order, created_at, updated_at)
        SELECT
            'department-existing-' || lower(replace(replace(trim(department), ' ', '-'), '/', '-')),
            trim(department),
            1,
            500,
            datetime('now'),
            datetime('now')
        FROM employees
        WHERE trim(department) != '';

        INSERT OR IGNORE INTO positions (id, name, is_active, sort_order, created_at, updated_at)
        SELECT
            'position-existing-' || lower(replace(replace(trim(position), ' ', '-'), '/', '-')),
            trim(position),
            1,
            500,
            datetime('now'),
            datetime('now')
        FROM employees
        WHERE trim(position) != '';

        CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);
        CREATE INDEX IF NOT EXISTS idx_positions_active ON positions(is_active);
    ",
    },
    Migration {
        id: "202605100001_payroll_whatsapp_delivery",
        sql: "
        ALTER TABLE employees ADD COLUMN whatsapp_number TEXT NOT NULL DEFAULT '';
        ALTER TABLE payroll_payslip_snapshots ADD COLUMN pdf_file_path TEXT NOT NULL DEFAULT '';

        CREATE TABLE IF NOT EXISTS payroll_payslip_delivery_statuses (
            payslip_snapshot_id TEXT PRIMARY KEY,
            status TEXT NOT NULL CHECK (status IN ('not_opened', 'opened', 'sent', 'failed')),
            opened_at TEXT,
            sent_at TEXT,
            failed_at TEXT,
            actor_user_id TEXT NOT NULL DEFAULT '',
            actor_display_name TEXT NOT NULL DEFAULT '',
            actor_role TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL,
            FOREIGN KEY (payslip_snapshot_id) REFERENCES payroll_payslip_snapshots(id)
        );
    ",
    },
    Migration {
        id: "202605100002_manual_payroll_drafts",
        sql: "
        CREATE TABLE IF NOT EXISTS payroll_manual_draft_items (
            id TEXT PRIMARY KEY,
            payroll_run_id TEXT NOT NULL,
            employee_id TEXT NOT NULL,
            income_components_json TEXT NOT NULL,
            deduction_components_json TEXT NOT NULL,
            gross_pay INTEGER NOT NULL,
            total_deductions INTEGER NOT NULL,
            net_pay INTEGER NOT NULL,
            amount_in_words TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id),
            FOREIGN KEY (employee_id) REFERENCES employees(id),
            UNIQUE (payroll_run_id, employee_id)
        );

        CREATE INDEX IF NOT EXISTS idx_payroll_manual_draft_items_run
            ON payroll_manual_draft_items(payroll_run_id);
    ",
    },
    Migration {
        id: "202605100003_email_delivery_resend",
        sql: "
        ALTER TABLE employees ADD COLUMN email TEXT NOT NULL DEFAULT '';

        CREATE TABLE IF NOT EXISTS email_delivery_settings (
            id TEXT PRIMARY KEY,
            provider TEXT NOT NULL DEFAULT 'resend' CHECK (provider IN ('resend')),
            enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
            resend_api_key TEXT NOT NULL DEFAULT '',
            from_name TEXT NOT NULL DEFAULT '',
            from_email TEXT NOT NULL DEFAULT '',
            reply_to_email TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        INSERT OR IGNORE INTO email_delivery_settings (
            id, provider, enabled, resend_api_key, from_name, from_email, reply_to_email, created_at, updated_at
        )
        VALUES (
            'default', 'resend', 0, '', '', '', '', datetime('now'), datetime('now')
        );

        ALTER TABLE payroll_payslip_delivery_statuses ADD COLUMN channel TEXT NOT NULL DEFAULT 'whatsapp_manual';
        ALTER TABLE payroll_payslip_delivery_statuses ADD COLUMN provider_message_id TEXT NOT NULL DEFAULT '';
        ALTER TABLE payroll_payslip_delivery_statuses ADD COLUMN error_message TEXT NOT NULL DEFAULT '';
    ",
    },
    Migration {
        id: "202605140001_split_payslip_delivery_statuses",
        sql: "
        ALTER TABLE payroll_payslip_delivery_statuses ADD COLUMN whatsapp_status TEXT NOT NULL DEFAULT 'not_opened';
        ALTER TABLE payroll_payslip_delivery_statuses ADD COLUMN email_status TEXT NOT NULL DEFAULT 'not_sent';
        ALTER TABLE payroll_payslip_delivery_statuses ADD COLUMN whatsapp_opened_at TEXT;
        ALTER TABLE payroll_payslip_delivery_statuses ADD COLUMN whatsapp_sent_at TEXT;
        ALTER TABLE payroll_payslip_delivery_statuses ADD COLUMN whatsapp_failed_at TEXT;
        ALTER TABLE payroll_payslip_delivery_statuses ADD COLUMN email_sent_at TEXT;
        ALTER TABLE payroll_payslip_delivery_statuses ADD COLUMN email_failed_at TEXT;
        ALTER TABLE payroll_payslip_delivery_statuses ADD COLUMN email_provider_message_id TEXT NOT NULL DEFAULT '';
        ALTER TABLE payroll_payslip_delivery_statuses ADD COLUMN whatsapp_error_message TEXT NOT NULL DEFAULT '';
        ALTER TABLE payroll_payslip_delivery_statuses ADD COLUMN email_error_message TEXT NOT NULL DEFAULT '';

        UPDATE payroll_payslip_delivery_statuses
        SET
            whatsapp_status = CASE
                WHEN channel = 'email_resend' THEN 'not_opened'
                WHEN status = 'sent' THEN 'sent_manual'
                ELSE status
            END,
            email_status = CASE
                WHEN channel = 'email_resend' THEN status
                ELSE 'not_sent'
            END,
            whatsapp_opened_at = CASE WHEN channel != 'email_resend' THEN opened_at ELSE NULL END,
            whatsapp_sent_at = CASE WHEN channel != 'email_resend' THEN sent_at ELSE NULL END,
            whatsapp_failed_at = CASE WHEN channel != 'email_resend' THEN failed_at ELSE NULL END,
            email_sent_at = CASE WHEN channel = 'email_resend' THEN sent_at ELSE NULL END,
            email_failed_at = CASE WHEN channel = 'email_resend' THEN failed_at ELSE NULL END,
            email_provider_message_id = CASE WHEN channel = 'email_resend' THEN provider_message_id ELSE '' END,
            whatsapp_error_message = CASE WHEN channel != 'email_resend' THEN error_message ELSE '' END,
            email_error_message = CASE WHEN channel = 'email_resend' THEN error_message ELSE '' END;
    ",
    },
    Migration {
        id: "202605110001_payslip_manager_foundation",
        sql: "
        CREATE TABLE IF NOT EXISTS payslip_periods (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'imported', 'pdf_ready', 'archived')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (start_date, end_date)
        );

        CREATE TABLE IF NOT EXISTS payslip_import_batches (
            id TEXT PRIMARY KEY,
            period_id TEXT NOT NULL,
            source_file_name TEXT NOT NULL,
            imported_by_user_id TEXT NOT NULL,
            imported_by_display_name TEXT NOT NULL,
            imported_by_role TEXT NOT NULL,
            total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
            valid_rows INTEGER NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
            error_rows INTEGER NOT NULL DEFAULT 0 CHECK (error_rows >= 0),
            notes TEXT NOT NULL DEFAULT '',
            imported_at TEXT NOT NULL,
            FOREIGN KEY (period_id) REFERENCES payslip_periods(id)
        );

        CREATE TABLE IF NOT EXISTS payslip_snapshots (
            id TEXT PRIMARY KEY,
            period_id TEXT NOT NULL,
            import_batch_id TEXT NOT NULL,
            employee_id TEXT,
            employee_nik TEXT NOT NULL DEFAULT '',
            employee_name TEXT NOT NULL,
            employee_position TEXT NOT NULL DEFAULT '',
            whatsapp_number TEXT NOT NULL DEFAULT '',
            snapshot_json TEXT NOT NULL,
            net_pay INTEGER NOT NULL DEFAULT 0,
            pdf_file_path TEXT NOT NULL DEFAULT '',
            send_status TEXT NOT NULL DEFAULT 'not_generated'
                CHECK (send_status IN ('not_generated', 'pdf_ready', 'whatsapp_opened', 'sent', 'failed_missing_number', 'failed')),
            whatsapp_opened_at TEXT,
            sent_marked_at TEXT,
            status_updated_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (period_id) REFERENCES payslip_periods(id),
            FOREIGN KEY (import_batch_id) REFERENCES payslip_import_batches(id),
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        );

        CREATE INDEX IF NOT EXISTS idx_payslip_periods_dates
            ON payslip_periods(start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_payslip_import_batches_period
            ON payslip_import_batches(period_id);
        CREATE INDEX IF NOT EXISTS idx_payslip_snapshots_period
            ON payslip_snapshots(period_id);
        CREATE INDEX IF NOT EXISTS idx_payslip_snapshots_batch
            ON payslip_snapshots(import_batch_id);
        CREATE INDEX IF NOT EXISTS idx_payslip_snapshots_send_status
            ON payslip_snapshots(send_status);
    ",
    },
    Migration {
        id: "202605140002_split_payslip_manager_send_status",
        sql: "
        ALTER TABLE payslip_snapshots ADD COLUMN whatsapp_status TEXT NOT NULL DEFAULT 'not_opened';
        ALTER TABLE payslip_snapshots ADD COLUMN email_status TEXT NOT NULL DEFAULT 'not_sent';
        ALTER TABLE payslip_snapshots ADD COLUMN whatsapp_sent_at TEXT;
        ALTER TABLE payslip_snapshots ADD COLUMN whatsapp_failed_at TEXT;
        ALTER TABLE payslip_snapshots ADD COLUMN email_sent_at TEXT;
        ALTER TABLE payslip_snapshots ADD COLUMN email_failed_at TEXT;
        ALTER TABLE payslip_snapshots ADD COLUMN email_error_message TEXT NOT NULL DEFAULT '';

        UPDATE payslip_snapshots
        SET
            whatsapp_status = CASE
                WHEN send_status = 'whatsapp_opened' THEN 'opened'
                WHEN send_status = 'failed_missing_number' THEN 'missing_number'
                WHEN send_status = 'failed' THEN 'failed'
                WHEN send_status = 'sent' AND whatsapp_opened_at IS NOT NULL THEN 'sent_manual'
                ELSE 'not_opened'
            END,
            email_status = CASE
                WHEN send_status = 'sent' AND whatsapp_opened_at IS NULL THEN 'sent'
                ELSE 'not_sent'
            END,
            whatsapp_sent_at = CASE
                WHEN send_status = 'sent' AND whatsapp_opened_at IS NOT NULL THEN sent_marked_at
                ELSE NULL
            END,
            whatsapp_failed_at = CASE WHEN send_status = 'failed' THEN status_updated_at ELSE NULL END,
            email_sent_at = CASE
                WHEN send_status = 'sent' AND whatsapp_opened_at IS NULL THEN sent_marked_at
                ELSE NULL
            END;

        CREATE INDEX IF NOT EXISTS idx_payslip_snapshots_whatsapp_status
            ON payslip_snapshots(whatsapp_status);
        CREATE INDEX IF NOT EXISTS idx_payslip_snapshots_email_status
            ON payslip_snapshots(email_status);
    ",
    },
];

pub fn initialize_local_database(app: &AppHandle) -> Result<DatabaseStatus, AppError> {
    let paths = resolve_database_paths(app)?;
    fs::create_dir_all(&paths.app_data_directory)?;
    fs::create_dir_all(&paths.backup_directory)?;

    let database_preexisted = paths.database_path.exists();
    let connection = Connection::open(&paths.database_path)?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    let journal_mode: String =
        connection.query_row("PRAGMA journal_mode=WAL", [], |row| row.get(0))?;

    ensure_migrations_table(&connection)?;
    if database_preexisted && has_pending_migrations(&connection)? {
        backup_service::create_safety_backup(app, "pre-migration")?;
    }

    let applied = apply_pending_migrations(&connection)?;
    let migrations_applied = count_applied_migrations(&connection)?;
    let foreign_keys_enabled = foreign_keys_enabled(&connection)?;

    if applied > 0 {
        connection.execute(
            "INSERT INTO local_backup_events (id, backup_path, reason, created_at)
             VALUES (?1, ?2, ?3, datetime('now'))",
            [
                format!("migration-{migrations_applied}"),
                paths.backup_directory.display().to_string(),
                "migration-applied".to_string(),
            ],
        )?;
    }

    Ok(DatabaseStatus {
        database_path: paths.database_path,
        backup_directory: paths.backup_directory,
        journal_mode,
        foreign_keys_enabled,
        migrations_applied,
    })
}

pub fn resolve_database_file(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(resolve_database_paths(app)?.database_path)
}

pub fn open_local_connection(app: &AppHandle) -> Result<Connection, AppError> {
    let database_path = resolve_database_file(app)?;
    let connection = Connection::open(database_path)?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    Ok(connection)
}

pub fn resolve_backup_directory(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(resolve_database_paths(app)?.backup_directory)
}

struct DatabasePaths {
    app_data_directory: PathBuf,
    database_path: PathBuf,
    backup_directory: PathBuf,
}

fn resolve_database_paths(app: &AppHandle) -> Result<DatabasePaths, AppError> {
    let app_data_directory = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Path(error.to_string()))?;

    Ok(DatabasePaths {
        database_path: app_data_directory.join(DATABASE_FILE_NAME),
        backup_directory: app_data_directory.join(BACKUP_DIRECTORY_NAME),
        app_data_directory,
    })
}

fn ensure_migrations_table(connection: &Connection) -> Result<(), AppError> {
    connection.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            id TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        )",
        [],
    )?;

    Ok(())
}

fn apply_pending_migrations(connection: &Connection) -> Result<u32, AppError> {
    let transaction = connection.unchecked_transaction()?;
    let mut applied = 0;

    for migration in MIGRATIONS {
        let already_applied: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE id = ?1)",
            [migration.id],
            |row| row.get(0),
        )?;

        if already_applied {
            continue;
        }

        transaction.execute_batch(migration.sql)?;
        transaction.execute(
            "INSERT INTO schema_migrations (id, applied_at) VALUES (?1, datetime('now'))",
            [migration.id],
        )?;
        applied += 1;
    }

    transaction.commit()?;
    Ok(applied)
}

fn has_pending_migrations(connection: &Connection) -> Result<bool, AppError> {
    for migration in MIGRATIONS {
        let already_applied: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE id = ?1)",
            [migration.id],
            |row| row.get(0),
        )?;

        if !already_applied {
            return Ok(true);
        }
    }

    Ok(false)
}

fn count_applied_migrations(connection: &Connection) -> Result<u32, AppError> {
    let count: i64 = connection.query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
        row.get(0)
    })?;

    u32::try_from(count).map_err(|error| AppError::Database(error.to_string()))
}

fn foreign_keys_enabled(connection: &Connection) -> Result<bool, AppError> {
    let enabled: u8 = connection.query_row("PRAGMA foreign_keys", [], |row| row.get(0))?;
    Ok(enabled == 1)
}

pub fn ensure_path_inside_directory(path: &Path, directory: &Path) -> Result<PathBuf, AppError> {
    let canonical_path = path.canonicalize()?;
    let canonical_directory = directory.canonicalize()?;

    if canonical_path.starts_with(&canonical_directory) {
        Ok(canonical_path)
    } else {
        Err(AppError::Path(
            "file harus berada di folder backup aplikasi".to_string(),
        ))
    }
}
