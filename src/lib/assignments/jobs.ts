// The jobs a client can be assigned for. Add a line here to add a job.
export const ASSIGNMENT_JOBS = [
  { key: 'advertising', label: 'Advertising', hint: 'Runs the daily ad sessions' },
  { key: 'admin', label: 'Admin', hint: 'Weekly Shopee report' },
  { key: 'pabrik_sosmed', label: 'Pabrik Sosmed', hint: 'Social media content' },
  { key: 'sales', label: 'Sales', hint: 'Account owner on the sales side' },
  { key: 'other', label: 'Other', hint: 'Any other duty' },
] as const;

export type AssignmentJob = (typeof ASSIGNMENT_JOBS)[number]['key'];
export const isAssignmentJob = (v: unknown): v is AssignmentJob => ASSIGNMENT_JOBS.some((j) => j.key === v);
