-- HRD Core: Employee Directory ("The Brain"), Cuti (Leave), and Kasbon (Cash Advance)
-- Safe to run multiple times (IF NOT EXISTS).

-- 1. Employee Master Profile per workspace (extends workspace_members + profiles)
CREATE TABLE IF NOT EXISTS public.employee_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,

  -- Identity & Job
  employee_code text,
  job_title text,
  department text,
  join_date date,
  contract_end_date date,
  emergency_contact_name text,
  emergency_contact_phone text,

  -- Work Schedule (Mon-Fri full day + Saturday half-day by default)
  work_start_time text NOT NULL DEFAULT '09:00',
  work_end_time text NOT NULL DEFAULT '18:00',
  sat_half_day boolean NOT NULL DEFAULT true,
  sat_work_start text NOT NULL DEFAULT '09:00',
  sat_work_end text NOT NULL DEFAULT '14:00',

  -- WFH (BOD ACC: Nico / Herlan / Lucy)
  wfh_approved boolean NOT NULL DEFAULT false,
  wfh_days text[] NOT NULL DEFAULT '{}', -- e.g. {'mon','wed','fri'}
  wfh_approved_by text,
  wfh_approved_at timestamptz,

  -- Annual Cuti (BOD ACC: Nico / Herlan / Lucy)
  cuti_eligible boolean NOT NULL DEFAULT false,
  annual_cuti_quota numeric(5,1) NOT NULL DEFAULT 12,
  cuti_approved_by text,
  cuti_approved_at timestamptz,

  -- Compensation, Bank, Tax & Kasbon Limit
  base_salary numeric(15,2) NOT NULL DEFAULT 0,
  allowances numeric(15,2) NOT NULL DEFAULT 0,
  bank_name text,
  bank_account_no text,
  bank_account_name text,
  npwp text,
  ptkp_status text DEFAULT 'TK/0',
  bpjs_kesehatan text,
  bpjs_ketenagakerjaan text,
  kasbon_limit numeric(15,2) NOT NULL DEFAULT 0,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_profiles_workspace ON public.employee_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_user ON public.employee_profiles(user_id);

-- 2. Cuti / Leave Requests
CREATE TABLE IF NOT EXISTS public.hrd_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  leave_type text NOT NULL CHECK (leave_type IN ('tahunan', 'sakit', 'izin', 'khusus', 'unpaid')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  half_day text NOT NULL DEFAULT 'none' CHECK (half_day IN ('none', 'am', 'pm')),
  days_count numeric(5,1) NOT NULL DEFAULT 1,
  reason text NOT NULL,
  attachment_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hrd_leave_workspace_status ON public.hrd_leave_requests(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_hrd_leave_user_dates ON public.hrd_leave_requests(user_id, start_date, end_date);

-- 3. Kasbon / Employee Cash Advance Requests
CREATE TABLE IF NOT EXISTS public.hrd_kasbon_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  installment_months integer NOT NULL DEFAULT 1 CHECK (installment_months >= 1 AND installment_months <= 24),
  monthly_installment numeric(15,2) NOT NULL DEFAULT 0,
  paid_amount numeric(15,2) NOT NULL DEFAULT 0,
  paid_installments integer NOT NULL DEFAULT 0,
  start_deduction_month text, -- YYYY-MM
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'disbursed', 'paying', 'paid_off', 'rejected', 'cancelled')),
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_note text,
  disbursed_at timestamptz,
  disbursed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hrd_kasbon_workspace_status ON public.hrd_kasbon_requests(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_hrd_kasbon_user ON public.hrd_kasbon_requests(user_id);

-- 4. Kasbon Payment / Installment Ledger
CREATE TABLE IF NOT EXISTS public.hrd_kasbon_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kasbon_id uuid NOT NULL REFERENCES public.hrd_kasbon_requests(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'payroll_deduction' CHECK (payment_method IN ('payroll_deduction', 'manual_transfer')),
  payroll_month text, -- YYYY-MM
  notes text,
  recorded_by uuid,
  recorded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hrd_kasbon_payments_kasbon ON public.hrd_kasbon_payments(kasbon_id);

-- Enable RLS (server actions use service role admin client with workspace/role checks)
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrd_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrd_kasbon_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrd_kasbon_payments ENABLE ROW LEVEL SECURITY;
