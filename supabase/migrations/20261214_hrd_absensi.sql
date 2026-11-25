-- HRD Absensi Upgrade: GPS, Geofence, WFO/WFH/Client Visit, Shift Late/Overtime, and Office Settings
-- Safe to run multiple times (IF NOT EXISTS).

-- Ensure base attendance table exists (preserves existing rows)
CREATE TABLE IF NOT EXISTS public.sales_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date date NOT NULL,
  check_in_time timestamptz,
  check_in_photo text,
  check_out_time timestamptz,
  check_out_photo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, date)
);

-- Extend sales_attendance with world-class HRD telemetry
ALTER TABLE public.sales_attendance
  ADD COLUMN IF NOT EXISTS work_mode text NOT NULL DEFAULT 'wfo',
  ADD COLUMN IF NOT EXISTS check_in_lat double precision,
  ADD COLUMN IF NOT EXISTS check_in_lng double precision,
  ADD COLUMN IF NOT EXISTS check_in_distance_m integer,
  ADD COLUMN IF NOT EXISTS check_out_lat double precision,
  ADD COLUMN IF NOT EXISTS check_out_lng double precision,
  ADD COLUMN IF NOT EXISTS check_out_distance_m integer,
  ADD COLUMN IF NOT EXISTS late_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_out_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'on_time',
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_sales_attendance_ws_date ON public.sales_attendance(workspace_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_attendance_ws_user_date ON public.sales_attendance(workspace_id, user_id, date DESC);

-- Office Geofence & Attendance Policy per Workspace
CREATE TABLE IF NOT EXISTS public.hrd_office_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  office_name text NOT NULL DEFAULT 'Kantor Pusat',
  office_lat double precision,
  office_lng double precision,
  geofence_radius_m integer NOT NULL DEFAULT 150,
  late_grace_minutes integer NOT NULL DEFAULT 5,
  require_gps boolean NOT NULL DEFAULT false,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hrd_office_settings ENABLE ROW LEVEL SECURITY;
