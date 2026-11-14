import { createAdminClient } from '@/lib/api/supabase-admin';
import { buildWhatsAppReport, currentSlot, type ReportSlot } from '@/lib/reports/whatsapp-report';
import { signedReportUrl, SHARE_TTL_SECONDS } from '@/lib/reports/signed-url';
import { sendWhatsApp } from './send';
import { sendReportPdfs, type ReportPdf } from './report-files';
import { loadBodDaily } from './bod-daily';
import { renderBodDailyPdf } from './bod-daily-pdf';
import { dmy } from '@/lib/reports/whatsapp-report';

/**
 * The team performance report (Sales, Admin, Advertiser, To Do, Accounting) for Nico, Herlan and Lucy.
 * The report itself is built by src/lib/reports/whatsapp-report.ts: the daily one at 19:00 Monday to Friday (about that day), the weekly one
 * on Monday at 08:00 (monthly on the first Monday of a month). This file only decides what is sent, to whom, and keeps the history.
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
  headline?: string;                   // weekly / monthly: the title line(s) above the PDFs
  files?: ReportPdf[];                 // weekly / monthly: one PDF per company (sent as files when "PDF files" is ON)
}

/** Builds the report for a day (default: today) without sending anything. */
export async function previewPerformance(dateOverride?: string, slot: ReportSlot = currentSlot()): Promise<PerformanceReport> {
  const res: any = await buildWhatsAppReport(dateOverride, slot);
  if (!res.send) return { send: false, kind: 'none', date: res.date, text: '', message: '' };
  let message: string = res.text;
  let files: ReportPdf[] | undefined;
  if (res.kind !== 'daily') {
    // Weekly / monthly: a short headline and a link to each company's PDF (the links last over a year).
    files = ((res.files || []) as { company: string; name: string }[]).map((f) => ({ company: f.company, name: f.name, url: signedReportUrl(ERP_ORIGIN, f.company, res.date, SHARE_TTL_SECONDS) }));
    message = [res.headline, ...files.map((f) => `${f.company}: ${f.url}`)].filter(Boolean).join('\n');
  }
  return { send: true, kind: res.kind, date: res.date, from: res.from, to: res.to, text: res.text, message, headline: res.headline || undefined, files };
}

export interface SendOutcome { sent: boolean; reason?: string; kind?: string; date?: string; recipients?: number; detail?: string }

/**
 * Builds and sends the report. trigger "cron" refuses to send the same report twice in a day;
 * "manual" sends to everyone active; "test" sends only to `onlyPhones`.
 */
export async function sendPerformance(workspaceId: string, opts: { trigger: 'cron' | 'manual' | 'test'; onlyPhones?: string[]; dateOverride?: string; slot?: ReportSlot }): Promise<SendOutcome> {
  const db = createAdminClient();
  const slot = opts.slot ?? currentSlot();
  const report = await previewPerformance(opts.dateOverride, slot);
  if (!report.send) return { sent: false, reason: slot === 'morning' ? 'The weekly report is only on Monday morning.' : 'There is no daily report on Saturday and Sunday.', kind: 'none', date: report.date };

  if (opts.trigger === 'cron') {
    const { data: already } = await db.from('wa_sends').select('id').eq('workspace_id', workspaceId).eq('kind', report.kind).eq('report_date', report.date).eq('ok', true).in('trigger', ['cron', 'manual']).limit(1);
    if (already && already.length) return { sent: false, reason: 'Already sent today.', kind: report.kind, date: report.date };
  }

  const { data: rec } = await db.from('wa_recipients').select('phone, receives_daily').eq('workspace_id', workspaceId).eq('active', true);
  // The daily report goes only to the people with the daily switch on (Nico and Herlan); weekly and monthly go to everyone.
  let phones = (rec || []).filter((r: any) => report.kind !== 'daily' || r.receives_daily !== false).map((r: any) => r.phone as string);
  if (opts.trigger === 'test') phones = phones.filter((p) => (opts.onlyPhones || []).includes(p));
  if (phones.length === 0) return { sent: false, reason: opts.trigger === 'test' ? 'That number is not an active recipient.' : 'No active recipient.', kind: report.kind, date: report.date };

  // Weekly / monthly with "send PDFs as files" ON: each PDF is a real file (a refused one falls back to its link). Everything else is text.
  const { data: settings } = await db.from('wa_settings').select('send_files').eq('workspace_id', workspaceId).maybeSingle();
  let r: { ok: boolean; detail: string };
  let sentText = report.message;
  if (report.kind === 'daily' && settings?.send_files) {
    // The daily BOD report is a 3-page PDF (Advertising, Admin, Sales). If it cannot be made or sent, the text report goes instead, so it is never lost.
    r = await sendDailyPdf(phones, report.date).catch((e: any) => ({ ok: false, detail: `PDF failed: ${String(e?.message || e).slice(0, 160)}` }));
    if (r.ok) sentText = `Daily BOD report (PDF) ${report.date}`;
    else { const t = await sendWhatsApp(phones, report.message); r = { ok: t.ok, detail: `${r.detail} Sent the text report instead: ${t.detail}` }; }
  } else {
    r = report.kind !== 'daily' && settings?.send_files && report.files && report.files.length
      ? await sendReportPdfs(phones, report.headline || '', report.files)
      : await sendWhatsApp(phones, report.message);
  }
  await db.from('wa_sends').insert({ workspace_id: workspaceId, kind: report.kind, report_date: report.date, trigger: opts.trigger, recipients: phones, ok: r.ok, detail: r.detail, text: sentText });
  return { sent: r.ok, reason: r.ok ? undefined : r.detail, kind: report.kind, date: report.date, recipients: phones.length, detail: r.detail };
}

/** Builds the 3-page daily BOD PDF for `today` and sends it as a file. The caption is just the title (no greeting). */
export async function sendDailyPdf(phones: string[], today: string): Promise<{ ok: boolean; detail: string }> {
  const data = await loadBodDaily(today);
  if (!data) return { ok: false, detail: 'There is no daily report for this day.' };
  const pdf = await renderBodDailyPdf(data);
  const name = `Daily-BOD-Report-${data.reportDay}.pdf`;
  const r = await sendWhatsApp(phones, `Daily Report ${dmy(data.reportDay)}`, { file: { data: new Uint8Array(pdf), filename: name, contentType: 'application/pdf' } });
  return { ok: r.ok, detail: r.ok ? `PDF sent: ${name}.` : `PDF refused: ${r.detail}` };
}
