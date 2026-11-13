import { phoneTail } from './channel';
/**
 * Lead sources, the pure parts (no database, no network): matching a new lead's first message with the message an ad pre-fills in WhatsApp,
 * and counting leads, clients, deals and sales per source. Tested.
 *
 * A "click to WhatsApp" ad (Meta, Google, TikTok) opens a chat with a ready-made first message, for example "Halo kak, saya mau tanya paket dari iklan Instagram".
 * Each ad has its own text, so the first message tells us which ad the lead came from.
 */

export const CHANNELS = ['meta_ads', 'google_ads', 'tiktok_ads', 'organic', 'referral', 'other'] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABEL: Record<Channel | 'unknown', string> = {
  meta_ads: 'Meta Ads', google_ads: 'Google Ads', tiktok_ads: 'TikTok Ads', organic: 'Organic', referral: 'Referral', other: 'Other', unknown: 'Unknown',
};
export const isChannel = (v: unknown): v is Channel => (CHANNELS as readonly string[]).includes(String(v));

export interface SourceDef { id: string; name: string; channel: Channel; first_message: string; active: boolean }

/** Lower case, no accents, no punctuation or emoji, single spaces. */
export function normalizeText(s: string): string {
  return String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const tokens = (s: string) => new Set(s.split(' ').filter((w) => w.length > 1));

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

export const MATCH_THRESHOLD = 0.8;
const MIN_PART = 12;     // a text this short ("halo") is too common to say anything

/** How alike a message is to an ad's text, 0 to 1. Exact = 1; one contains the other = 0.9 to 0.95; otherwise the share of words they have in common. */
export function similarity(message: string, adText: string): number {
  const m = normalizeText(message);
  const a = normalizeText(adText);
  if (!m || !a) return 0;
  if (m === a) return 1;
  if (a.length >= MIN_PART && m.includes(a)) return 0.95;
  if (m.length >= MIN_PART && a.includes(m)) return 0.9;
  const tm = tokens(m), ta = tokens(a);
  return tm.size >= 3 && ta.size >= 3 ? jaccard(tm, ta) : 0;
}

/** The active source whose text best matches the first message (at least 0.8), or null. */
export function matchSource(message: string, sources: SourceDef[]): { source: SourceDef; score: number } | null {
  let best: { source: SourceDef; score: number } | null = null;
  for (const s of sources) {
    if (!s.active) continue;
    const score = similarity(message, s.first_message);
    if (score < MATCH_THRESHOLD) continue;
    if (!best || score > best.score || (score === best.score && s.first_message.length > best.source.first_message.length)) best = { source: s, score };
  }
  return best;
}

/** Checks a source the team typed in. Returns the cleaned source or a message. */
export function cleanSource(input: { name?: unknown; channel?: unknown; first_message?: unknown }): { ok: true; value: { name: string; channel: Channel; first_message: string } } | { ok: false; error: string } {
  const name = String(input.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const message = String(input.first_message ?? '').replace(/\r\n/g, '\n').trim();
  if (!name) return { ok: false, error: 'Give the source a name, like "Meta Ads: Promo Paket Sultan".' };
  if (!isChannel(input.channel)) return { ok: false, error: 'Pick where the ad runs (Meta Ads, Google Ads...).' };
  if (normalizeText(message).length < MIN_PART) return { ok: false, error: 'Paste the whole first message the ad pre-fills in WhatsApp (at least a short sentence).' };
  if (message.length > 600) return { ok: false, error: 'The message is too long (max 600 characters).' };
  return { ok: true, value: { name, channel: input.channel, first_message: message } };
}

// ---------------------------------------------------------------- the report
export interface ReportChat { group_id: string; wa_id: string; first_message_at: string | null; source_id: string | null; source_label: string | null; source_channel: string | null }
export interface ReportClient { id: string; phone: string | null }
export interface ReportDeal { client_id: string; stage: string | null; value: number | string | null }

export interface SourceRow { key: string; label: string; channel: Channel | 'unknown'; leads: number; clients: number; deals: number; won: number; wonValue: number }
export interface ChannelRow { channel: Channel | 'unknown'; leads: number; clients: number; deals: number; won: number; wonValue: number }

const tail9 = (s: string | null | undefined) => phoneTail(s);

/** Leads (new chats), how many are already clients in the ERP (same phone number), how many deals they have, and how many were won (stage "Deal") and for how much. */
export function sourceReport(chats: ReportChat[], clients: ReportClient[], deals: ReportDeal[]): { rows: SourceRow[]; channels: ChannelRow[]; total: Omit<SourceRow, 'key' | 'label' | 'channel'> } {
  const clientByPhone = new Map<string, string>();
  for (const c of clients) { const t = tail9(c.phone); if (t.length >= 8 && !clientByPhone.has(t)) clientByPhone.set(t, c.id); }
  const dealsByClient = new Map<string, ReportDeal[]>();
  for (const d of deals) { const l = dealsByClient.get(d.client_id) || []; l.push(d); dealsByClient.set(d.client_id, l); }

  const rows = new Map<string, SourceRow>();
  for (const ch of chats) {
    const channel: SourceRow['channel'] = isChannel(ch.source_channel) ? ch.source_channel : 'unknown';
    const key = ch.source_id || `none:${channel}`;
    const label = ch.source_label || (channel === 'unknown' ? 'No source found' : CHANNEL_LABEL[channel]);
    const row = rows.get(key) || { key, label, channel, leads: 0, clients: 0, deals: 0, won: 0, wonValue: 0 };
    row.leads++;
    const clientId = clientByPhone.get(tail9(ch.wa_id));
    if (clientId) {
      row.clients++;
      const mine = dealsByClient.get(clientId) || [];
      row.deals += mine.length;
      for (const d of mine) if (d.stage === 'Deal') { row.won++; row.wonValue += Number(d.value || 0); }
    }
    rows.set(key, row);
  }
  const list = [...rows.values()].sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label));
  const byChannel = new Map<SourceRow['channel'], ChannelRow>();
  for (const r of list) {
    const c = byChannel.get(r.channel) || { channel: r.channel, leads: 0, clients: 0, deals: 0, won: 0, wonValue: 0 };
    c.leads += r.leads; c.clients += r.clients; c.deals += r.deals; c.won += r.won; c.wonValue += r.wonValue;
    byChannel.set(r.channel, c);
  }
  const total = list.reduce((t, r) => ({ leads: t.leads + r.leads, clients: t.clients + r.clients, deals: t.deals + r.deals, won: t.won + r.won, wonValue: t.wonValue + r.wonValue }), { leads: 0, clients: 0, deals: 0, won: 0, wonValue: 0 });
  return { rows: list, channels: [...byChannel.values()].sort((a, b) => b.leads - a.leads), total };
}
