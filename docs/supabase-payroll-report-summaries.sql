-- HRIS Portal Employees: owner payroll summary table
-- Run this in the Portal Employees Supabase SQL editor.
-- This stores aggregate payroll summaries published from the desktop app.

create table if not exists public.payroll_report_summaries (
  id uuid primary key default gen_random_uuid(),
  desktop_period_id text not null unique,
  payroll_period text not null,
  period_start date not null,
  period_end date not null,
  employee_count integer not null default 0 check (employee_count >= 0),
  gross_pay bigint not null default 0 check (gross_pay >= 0),
  total_deductions bigint not null default 0 check (total_deductions >= 0),
  net_pay bigint not null default 0 check (net_pay >= 0),
  income_components jsonb not null default '[]'::jsonb,
  deduction_components jsonb not null default '[]'::jsonb,
  payslip_published_count integer not null default 0 check (payslip_published_count >= 0),
  payslip_failed_count integer not null default 0 check (payslip_failed_count >= 0),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payroll_report_summaries_period_dates
  on public.payroll_report_summaries (period_start desc, period_end desc);

alter table public.payroll_report_summaries enable row level security;

drop policy if exists "owner can read payroll summaries" on public.payroll_report_summaries;
create policy "owner can read payroll summaries"
  on public.payroll_report_summaries
  for select
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'owner_management'
  );

-- Desktop publish uses the configured Supabase Secret Key/service context.
-- Do not add INSERT/UPDATE policies for normal authenticated portal users.
