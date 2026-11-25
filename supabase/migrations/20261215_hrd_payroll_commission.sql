-- HRD Phase 4: Commission (%) in Employee Directory & Per-Staff Payroll Calculator
-- Safe to run multiple times (IF NOT EXISTS).

-- 1. Add commission_rate (%) to employee_profiles
ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,2) NOT NULL DEFAULT 0;

-- 2. Monthly Per-Staff Payroll Calculation & Payslip Runs
CREATE TABLE IF NOT EXISTS public.hrd_payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  payroll_month text NOT NULL, -- YYYY-MM

  staff_id text,
  employee_name text NOT NULL,
  role_title text,
  department text,
  bank_info text,

  -- Earnings
  base_salary numeric(15,2) NOT NULL DEFAULT 0,
  allowances numeric(15,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,2) NOT NULL DEFAULT 0,
  commission_base numeric(15,2) NOT NULL DEFAULT 0,
  commission_amount numeric(15,2) NOT NULL DEFAULT 0,
  bonus_amount numeric(15,2) NOT NULL DEFAULT 0,
  overtime_pay numeric(15,2) NOT NULL DEFAULT 0,

  -- Deductions
  kasbon_deduction numeric(15,2) NOT NULL DEFAULT 0,
  late_penalty numeric(15,2) NOT NULL DEFAULT 0,
  unpaid_leave_deduction numeric(15,2) NOT NULL DEFAULT 0,
  other_deduction numeric(15,2) NOT NULL DEFAULT 0,

  -- Totals
  gross_salary numeric(15,2) NOT NULL DEFAULT 0,
  total_deductions numeric(15,2) NOT NULL DEFAULT 0,
  net_salary numeric(15,2) NOT NULL DEFAULT 0,

  -- Snapshot telemetry from Absensi & Cuti
  attendance_days integer NOT NULL DEFAULT 0,
  late_minutes integer NOT NULL DEFAULT 0,
  overtime_minutes integer NOT NULL DEFAULT 0,
  unpaid_leave_days numeric(5,1) NOT NULL DEFAULT 0,

  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  notes text,
  paid_at timestamptz,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, payroll_month)
);

CREATE INDEX IF NOT EXISTS idx_hrd_payroll_runs_ws_month ON public.hrd_payroll_runs(workspace_id, payroll_month);

ALTER TABLE public.hrd_payroll_runs ENABLE ROW LEVEL SECURITY;
