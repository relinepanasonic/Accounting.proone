export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export const WFH_DAY_OPTIONS: { key: WeekdayKey; short: string; label: string }[] = [
  { key: 'mon', short: 'Sen', label: 'Senin' },
  { key: 'tue', short: 'Sel', label: 'Selasa' },
  { key: 'wed', short: 'Rab', label: 'Rabu' },
  { key: 'thu', short: 'Kam', label: 'Kamis' },
  { key: 'fri', short: 'Jum', label: 'Jumat' },
  { key: 'sat', short: 'Sab', label: 'Sabtu (Half Day)' },
];

export type LeaveType = 'tahunan' | 'sakit' | 'izin' | 'khusus' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type HalfDayOption = 'none' | 'am' | 'pm';

export const LEAVE_TYPE_META: Record<LeaveType, { label: string; desc: string; tone: string; deductsAnnual: boolean }> = {
  tahunan: { label: 'Cuti Tahunan', desc: 'Mengurangi kuota cuti tahunan (butuh BOD ACC)', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', deductsAnnual: true },
  sakit: { label: 'Cuti Sakit', desc: 'Lampirkan surat dokter jika > 1 hari', tone: 'border-sky-500/40 bg-sky-500/10 text-sky-300', deductsAnnual: false },
  izin: { label: 'Izin', desc: 'Keperluan pribadi / mendesak', tone: 'border-amber-500/40 bg-amber-500/10 text-amber-300', deductsAnnual: false },
  khusus: { label: 'Cuti Khusus', desc: 'Nikah, melahirkan, duka (tidak potong kuota)', tone: 'border-purple-500/40 bg-purple-500/10 text-purple-300', deductsAnnual: false },
  unpaid: { label: 'Unpaid Leave', desc: 'Cuti di luar tanggungan (potong gaji)', tone: 'border-red-500/40 bg-red-500/10 text-red-300', deductsAnnual: false },
};

export type KasbonStatus = 'pending' | 'approved' | 'disbursed' | 'paying' | 'paid_off' | 'rejected' | 'cancelled';

export const KASBON_STATUS_META: Record<KasbonStatus, { label: string; tone: string }> = {
  pending: { label: 'Pending BOD', tone: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  approved: { label: 'Approved (Wait Transfer)', tone: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
  disbursed: { label: 'Disbursed', tone: 'border-purple-500/40 bg-purple-500/10 text-purple-300' },
  paying: { label: 'Cicilan Berjalan', tone: 'border-[#d4af37]/50 bg-[#d4af37]/10 text-[#f5d77f]' },
  paid_off: { label: 'Lunas', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  rejected: { label: 'Rejected', tone: 'border-red-500/40 bg-red-500/10 text-red-300' },
  cancelled: { label: 'Cancelled', tone: 'border-zinc-700 bg-zinc-900 text-zinc-400' },
};

export interface EmployeeProfileData {
  employeeCode: string;
  jobTitle: string;
  department: string;
  joinDate: string;
  contractEndDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  workStartTime: string;
  workEndTime: string;
  satHalfDay: boolean;
  satWorkStart: string;
  satWorkEnd: string;
  wfhApproved: boolean;
  wfhDays: WeekdayKey[];
  wfhApprovedBy: string;
  cutiEligible: boolean;
  annualCutiQuota: number;
  cutiApprovedBy: string;
  baseSalary: number;
  allowances: number;
  commissionRate: number;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  npwp: string;
  ptkpStatus: string;
  bpjsKesehatan: string;
  bpjsKetenagakerjaan: string;
  kasbonLimit: number;
  notes: string;
}

export const DEFAULT_EMPLOYEE_PROFILE: EmployeeProfileData = {
  employeeCode: '',
  jobTitle: '',
  department: '',
  joinDate: '',
  contractEndDate: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  workStartTime: '09:00',
  workEndTime: '18:00',
  satHalfDay: true,
  satWorkStart: '09:00',
  satWorkEnd: '14:00',
  wfhApproved: false,
  wfhDays: [],
  wfhApprovedBy: '',
  cutiEligible: false,
  annualCutiQuota: 12,
  cutiApprovedBy: '',
  baseSalary: 0,
  allowances: 0,
  commissionRate: 0,
  bankName: '',
  bankAccountNo: '',
  bankAccountName: '',
  npwp: '',
  ptkpStatus: 'TK/0',
  bpjsKesehatan: '',
  bpjsKetenagakerjaan: '',
  kasbonLimit: 0,
  notes: '',
};

export function mapDbProfile(row: any | null | undefined): EmployeeProfileData {
  if (!row) return { ...DEFAULT_EMPLOYEE_PROFILE };
  return {
    employeeCode: row.employee_code || '',
    jobTitle: row.job_title || '',
    department: row.department || '',
    joinDate: row.join_date || '',
    contractEndDate: row.contract_end_date || '',
    emergencyContactName: row.emergency_contact_name || '',
    emergencyContactPhone: row.emergency_contact_phone || '',
    workStartTime: row.work_start_time || '09:00',
    workEndTime: row.work_end_time || '18:00',
    satHalfDay: row.sat_half_day !== false,
    satWorkStart: row.sat_work_start || '09:00',
    satWorkEnd: row.sat_work_end || '14:00',
    wfhApproved: Boolean(row.wfh_approved),
    wfhDays: Array.isArray(row.wfh_days) ? (row.wfh_days as WeekdayKey[]) : [],
    wfhApprovedBy: row.wfh_approved_by || '',
    cutiEligible: Boolean(row.cuti_eligible),
    annualCutiQuota: Number(row.annual_cuti_quota ?? 12),
    cutiApprovedBy: row.cuti_approved_by || '',
    baseSalary: Number(row.base_salary || 0),
    allowances: Number(row.allowances || 0),
    commissionRate: Number(row.commission_rate || 0),
    bankName: row.bank_name || '',
    bankAccountNo: row.bank_account_no || '',
    bankAccountName: row.bank_account_name || '',
    npwp: row.npwp || '',
    ptkpStatus: row.ptkp_status || 'TK/0',
    bpjsKesehatan: row.bpjs_kesehatan || '',
    bpjsKetenagakerjaan: row.bpjs_ketenagakerjaan || '',
    kasbonLimit: Number(row.kasbon_limit || 0),
    notes: row.notes || '',
  };
}

/**
 * Computes working days between two YYYY-MM-DD dates (inclusive).
 * Sundays are 0; Saturdays are 0.5 when satHalfDay is true (default), else 1.
 * Single-day half-day requests return 0.5.
 */
export function calculateWorkdays(startDate: string, endDate: string, halfDay: HalfDayOption = 'none', satHalfDay = true): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  if (startDate === endDate && halfDay !== 'none') {
    const dow = start.getUTCDay();
    return dow === 0 ? 0 : 0.5;
  }

  let total = 0;
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const dow = new Date(t).getUTCDay();
    if (dow === 0) continue; // Sunday off
    if (dow === 6) {
      total += satHalfDay ? 0.5 : 1;
    } else {
      total += 1;
    }
  }
  return Math.round(total * 10) / 10;
}

export function formatRp(amount: number): string {
  return `Rp ${Math.round(Number(amount || 0)).toLocaleString('id-ID')}`;
}

export function isHrdBodRole(role: string): boolean {
  return role === 'founder' || role === 'superadmin' || role === 'accounting';
}

export function isMissingHrdTableError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return /42P01|PGRST205|does not exist|Could not find the table/i.test(msg);
}
