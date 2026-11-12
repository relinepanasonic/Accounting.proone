import { createAdminClient } from '@/lib/api/supabase-admin';
import { buildWhatsAppReport } from '@/lib/reports/whatsapp-report';
import { signedReportUrl, SHARE_TTL_SECONDS } from '@/lib/reports/signed-url';
import { sendWhatsApp } from './send';
import { signAsOli } from './oli';

/**
 * The team performance report (Sales, Admin, Advertiser, To Do, Accounting) for Nico, Herlan and Lucy.
 * The report itself is built by src/lib/reports/whatsapp-report.ts (daily Tue-Sat, weekly on Monday, monthly on the first
 * Monday of a month, nothing on Sunday). This file only decides what is sent, to whom, and keeps the history.
 * It replaces the Make.com scenario "Daily / Weekly Report WhatsApp": Make only fetched the text and called Fonnte.
 */

export const ERP_ORIGIN = 'https://erp.profesoronline.id';

export interface PerformanceReport {
  send: boolean;                       // false on a Sunday
  kind: 'daily' | 'weekly' | 'monthly' | 'none';
  date: string;                        // the Jakarta "today" it was built for
  from?: string;
  to?: string;
  text: string;                        // the full report (what the Founder page shows)
  message: string;                     // what goes to WhatsApp: the text on a daily, a headline + PDF links on weekly / monthly
}

/** Builds the report for a day (default: today) without sending anything. */
export async function previewPerformance(dateOverride?: string): Promise<PerformanceReport> {
  const res: any = await buildWhatsAppReport(dateOverride);
  if (!res.send) return { send: false, kind: 'none', date: res.date, text: '', message: '' };
  let message: string = res.text;
  if (res.kind !== 'daily') {
    // Weekly / monthly: a short headline and a link to each company's PDF (the links last over a year).
    const links = ((res.files || []) as { company: string }[]).map((f) => `${f.company}: ${signedReportUrl(ERP_ORIGIN, f.company, res.date, SHARE_TTL_SECONDS)}`);
    message = [res.headline, ...links].filter(Boolean).join('\n');
  }
  // The WhatsApp message is written as coming from Oli; `text` stays the plain report for the Founder page.
  return { send: true, kind: res.kind, date: res.date, from: res.from, to: res.to, text: res.text, message: signAsOli(res.kind, message) };
}

export interface SendOutcome { sent: boolean; reason?: string; kind?: string; date?: string; recipients?: number; detail?: string }

/**
 * Builds and sends the report. trigger "cron" refuses to send the same report twice in a day;
 * "manual" sends to everyone active; "test" sends only to `onlyPhones`.
 */
export async function sendPerformance(workspaceId: string, opts: { trigger: 'cron' | 'manual' | 'test'; onlyPhones?: string[]; dateOverride?: string }): Promise<SendOutcome> {
  const db = createAdminClient();
  const report = await previewPerformance(opts.dateOverride);
  if (!report.send) return { sent: false, reason: 'Sunday: there is no report today.', kind: 'none', date: report.date };

  if (opts.trigger === 'cron') {
    const { data: already } = await db.from('wa_sends').select('id').eq('workspace_id', workspaceId).eq('kind', report.kind).eq('report_date', report.date).eq('ok', true).in('trigger', ['cron', 'manual']).limit(1);
    if (already && already.length) return { sent: false, reason: 'Already sent today.', kind: report.kind, date: report.date };
  }

  const { data: rec } = await db.from('wa_recipients').select('phone').eq('workspace_id', workspaceId).eq('active', true);
  let phones = (rec || []).map((r: any) => r.phone as string);
  if (opts.trigger === 'test') phones = phones.filter((p) => (opts.onlyPhones || []).includes(p));
  if (phones.length === 0) return { sent: false, reason: opts.trigger === 'test' ? 'That number is not an active recipient.' : 'No active recipient.', kind: report.kind, date: report.date };

  const r = await sendWhatsApp(phones, report.message);
  await db.from('wa_sends').insert({ workspace_id: workspaceId, kind: report.kind, report_date: report.date, trigger: opts.trigger, recipients: phones, ok: r.ok, detail: r.detail, text: report.message });
  return { sent: r.ok, reason: r.ok ? undefined : r.detail, kind: report.kind, date: report.date, recipients: phones.length, detail: r.detail };
}
