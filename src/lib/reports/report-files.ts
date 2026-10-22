import type { ReportPlan } from '@/lib/reports/whatsapp-report';

/** Companies that get their own PDF in the weekly / monthly report (codes of lib/workspaces/known.ts). */
export const REPORT_COMPANIES = ['ProOne', 'PLIG'] as const;
export type ReportCompany = (typeof REPORT_COMPANIES)[number];

export const MONTH_NAMES_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Google Drive: "Report ProOne" folder of harapanbaru1224@gmail.com. Reports go to <root>/<year>/<mm Month>/. */
export const DRIVE_ROOT_FOLDER = '1RyuSC2OpmIvWkrUZ89dwed0nTNjhEViX';

/** Folder ids by "yyyy-mm". A month that is missing here is uploaded into the root folder (never lost): add its folders and the id. */
export const DRIVE_MONTH_FOLDERS: Record<string, string> = {
  '2026-10': '1JGHodSpI9EpL_DyxmBQPoqnGJ-Em8RVt',
  '2026-11': '1c5a9aVjHae7AsCYOrjqq8AOJeq9kk22t',
  '2026-12': '1J9o6FhD03xIWP7HkjcPJC2rw6G82qGeA',
  '2027-01': '1JZ0cH0ML1iEKOtnvBhF94zRQ3f4a8tqR',
  '2027-02': '1MCUE2jCkZ8DihTGcHCURFXjlFFZOt5KD',
  '2027-03': '1ued9Fl56k8RsuTU55qLHl5GQJ8pH0UMw',
  '2027-04': '1BEmJ4DQNLTv4nqiAhzP5DVLLXGNEyM1D',
  '2027-05': '1e6hDT6MrzE0PZ8dIlk4p3kSEAt0yeZSX',
  '2027-06': '1ct2Dfmoa6LITHC7-Sfj3VR0zOO8wU5BL',
  '2027-07': '1zWf2IDaBfKS5A_aj_hir6i5wK2vVhQxz',
  '2027-08': '1rTS3p1mIuASTeHfwyn4kYxGYyNMdiddK',
  '2027-09': '1RyPldlTiGMboKuoL6PuwWrgqNolMAjSO',
  '2027-10': '1uCdd-_RIUQCfYlkyPPlQ2vfPHC1X-eUt',
  '2027-11': '1tvaTHe7CXTQVoo05LnmAV4Es0d1XQIHh',
  '2027-12': '1iG_4jTXr5HcznTaeA-jLlmwpoTo8rq8z',
};

export interface ReportFile {
  company: ReportCompany;
  /** ProOne.26.10.week3.pdf (weekly) or PLIG.26.Oktober.pdf (monthly). */
  name: string;
  /** The Drive folder to upload into (the month folder, or the root when that month has no folder yet). */
  folderId: string;
  /** Where the file would live: 2026 / 10 Oktober. */
  folderPath: string;
}

/** Which week of the month a weekly report is: it is sent on a Monday and covers the 1st up to yesterday. Monday the 12th = week 1. */
export const weekOfMonth = (today: string) => Math.floor((Number(today.slice(8, 10)) - 1) / 7);

export function reportFiles(plan: ReportPlan, today: string): ReportFile[] {
  if (plan.kind !== 'weekly' && plan.kind !== 'monthly') return [];
  const year = plan.to.slice(0, 4);
  const month = plan.to.slice(5, 7);
  const yy = year.slice(2);
  const monthName = MONTH_NAMES_ID[Number(month) - 1];
  const key = `${year}-${month}`;
  return REPORT_COMPANIES.map((company) => ({
    company,
    name: plan.kind === 'weekly' ? `${company}.${yy}.${month}.week${weekOfMonth(today)}.pdf` : `${company}.${yy}.${monthName}.pdf`,
    folderId: DRIVE_MONTH_FOLDERS[key] || DRIVE_ROOT_FOLDER,
    folderPath: `${year} / ${month} ${monthName}`,
  }));
}
