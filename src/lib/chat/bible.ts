import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { askBotModel } from '@/lib/wa/bot/model';
import { forget, memo } from './cache';
import { ASK_SYSTEM, BIBLE_BUCKET, buildKnowledge, checkUpload, DECK_SYSTEM, DECK_USER, storagePath, type BibleDocText } from './bible-text';

/**
 * The AI Bible (server side): the Sales Deck and other documents the sales bot and "Suggest reply" read.
 * A PDF goes straight from the browser to a private bucket (a signed upload link, so a big deck never passes through a function), then Claude reads it
 * once and its text is saved here: the team can correct it, and a price change is a text edit or a new upload. Older versions are kept.
 */

type Who = { userId: string; name: string };
type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

export interface BibleDocRow {
  id: string; title: string; kind: string; file_name: string | null; file_size: number | null; status: 'processing' | 'ready' | 'failed'; error: string | null;
  active: boolean; version: number; replaces: string | null; uploaded_by: string | null; created_at: string; text_updated_at: string; text_updated_by: string | null; chars: number;
}
const COLS = 'id, title, kind, file_name, file_size, status, error, active, version, replaces, uploaded_by, created_at, text_updated_at, text_updated_by';

export async function listDocs(ws: string): Promise<BibleDocRow[]> {
  const db = createAdminClient();
  const { data } = await db.from('ai_bible_docs').select(`${COLS}, text`).eq('workspace_id', ws).order('created_at', { ascending: false }).limit(100);
  return (data || []).map((d: any) => { const { text, ...rest } = d; return { ...rest, chars: String(text || '').length } as BibleDocRow; });
}

export async function getDoc(ws: string, id: string) {
  const { data } = await createAdminClient().from('ai_bible_docs').select(`${COLS}, text`).eq('id', id).eq('workspace_id', ws).maybeSingle();
  return data ? { ...(data as any), chars: String((data as any).text || '').length } : null;
}

/** A one-time link the browser uses to upload the PDF straight to the private bucket. */
export async function createUploadUrl(ws: string, fileName: string, size: number): Promise<{ ok: true; path: string; token: string; bucket: string } | Fail> {
  const problem = checkUpload(fileName, size);
  if (problem) return fail(400, problem);
  const path = storagePath(ws, fileName);
  const { data, error } = await createAdminClient().storage.from(BIBLE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return fail(500, `Could not prepare the upload: ${error?.message || 'unknown error'}`);
  return { ok: true, path, token: data.token, bucket: BIBLE_BUCKET };
}

const MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5'];

/** Claude reads the whole PDF (text and pictures) and writes out the packages, prices and terms. */
export async function readDeck(pdf: Uint8Array): Promise<{ text: string; model: string }> {
  const client = new Anthropic({ timeout: 110_000, maxRetries: 0 });
  const errors: string[] = [];
  for (const model of MODELS) {
    try {
      const res: any = await client.messages.create({
        model, max_tokens: 8000, system: DECK_SYSTEM,
        messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(pdf).toString('base64') } }, { type: 'text', text: DECK_USER }] }],
      } as any);
      let text = '';
      for (const b of res.content) if (b.type === 'text') text += b.text;
      if (text.trim()) return { text: text.trim(), model: res.model || model };
      errors.push(`${model}: empty answer`);
    } catch (e: any) {
      errors.push(`${model}: ${String(e?.message || e).slice(0, 120)}`);
    }
  }
  throw new Error(`The deck could not be read (${errors.join('; ')})`);
}

/** After the browser uploaded the PDF: record it, have Claude read it, save the text. With `replaces`, the old version is switched off. */
export async function ingestDeck(ws: string, input: { path: string; title: string; replaces?: string | null }, by: Who): Promise<{ ok: true; doc: any } | Fail> {
  const db = createAdminClient();
  if (!input.path.startsWith(`${ws}/`) || input.path.includes('..')) return fail(400, 'That file is not in this company\'s folder.');
  const title = String(input.title || '').trim().slice(0, 100) || 'Sales Deck';

  const { data: file, error: dErr } = await db.storage.from(BIBLE_BUCKET).download(input.path);
  if (dErr || !file) return fail(400, 'The uploaded file was not found. Please upload it again.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const problem = checkUpload(input.path, bytes.byteLength);
  if (problem) return fail(400, problem);

  let version = 1;
  if (input.replaces) {
    const { data: old } = await db.from('ai_bible_docs').select('version').eq('id', input.replaces).eq('workspace_id', ws).maybeSingle();
    if (old) version = Number((old as any).version || 1) + 1;
  }
  const { data: row, error: iErr } = await db.from('ai_bible_docs').insert({
    workspace_id: ws, title, kind: 'sales_deck', file_path: input.path, file_name: input.path.split('/').pop(), file_size: bytes.byteLength,
    status: 'processing', active: false, version, replaces: input.replaces || null, uploaded_by: by.name, text_updated_by: by.name,
  }).select('id').single();
  if (iErr || !row) return fail(500, `Could not save the document: ${iErr?.message}`);
  const id = (row as any).id as string;

  try {
    const { text } = await readDeck(bytes);
    const now = new Date().toISOString();
    // The new version takes over: the one it replaces is switched off (and kept).
    if (input.replaces) await db.from('ai_bible_docs').update({ active: false }).eq('id', input.replaces).eq('workspace_id', ws);
    await db.from('ai_bible_docs').update({ text, status: 'ready', active: true, error: null, text_updated_at: now }).eq('id', id);
  } catch (e: any) {
    await db.from('ai_bible_docs').update({ status: 'failed', error: String(e?.message || e).slice(0, 300) }).eq('id', id);
    forget(`knowledge:${ws}`);
    return fail(502, String(e?.message || e).slice(0, 300));
  }
  forget(`knowledge:${ws}`);
  return { ok: true, doc: await getDoc(ws, id) };
}

/** Change the title, the text the AI reads (a price fix), or switch the document on or off. */
export async function saveDoc(ws: string, id: string, patch: { title?: string; text?: string; active?: boolean }, by: Who): Promise<{ ok: true } | Fail> {
  const row: Record<string, unknown> = {};
  if (typeof patch.title === 'string') { const t = patch.title.trim().slice(0, 100); if (!t) return fail(400, 'The title cannot be empty.'); row.title = t; }
  if (typeof patch.text === 'string') {
    if (patch.text.length > 60000) return fail(400, 'The text is too long (max 60,000 characters).');
    row.text = patch.text; row.text_updated_at = new Date().toISOString(); row.text_updated_by = by.name;
  }
  if (typeof patch.active === 'boolean') row.active = patch.active;
  if (!Object.keys(row).length) return fail(400, 'Nothing to change.');
  const { data, error } = await createAdminClient().from('ai_bible_docs').update(row).eq('id', id).eq('workspace_id', ws).select('id').maybeSingle();
  if (error) return fail(500, error.message);
  if (!data) return fail(404, 'Document not found.');
  forget(`knowledge:${ws}`);
  return { ok: true };
}

export async function deleteDoc(ws: string, id: string): Promise<{ ok: true } | Fail> {
  const db = createAdminClient();
  const { data } = await db.from('ai_bible_docs').select('file_path').eq('id', id).eq('workspace_id', ws).maybeSingle();
  if (!data) return fail(404, 'Document not found.');
  if ((data as any).file_path) await db.storage.from(BIBLE_BUCKET).remove([(data as any).file_path]);
  const { error } = await db.from('ai_bible_docs').delete().eq('id', id).eq('workspace_id', ws);
  forget(`knowledge:${ws}`);
  return error ? fail(500, error.message) : { ok: true };
}

// ---------------------------------------------------------------- what the AI reads
/** The bot script plus every active document: the one text the bot, "Suggest reply" and the question box read. Kept for 30 seconds, dropped on every change. */
export const loadKnowledge = (ws: string, scriptOverride?: string) => memo(`knowledge:${ws}${scriptOverride === undefined ? '' : ':o'}`, 30_000, async () => {
  const db = createAdminClient();
  const [{ data: cfg }, { data: docs }] = await Promise.all([
    scriptOverride === undefined ? db.from('wa_bot_config').select('knowledge').eq('workspace_id', ws).maybeSingle() : Promise.resolve({ data: { knowledge: scriptOverride } }),
    db.from('ai_bible_docs').select('title, text, text_updated_at, active, status').eq('workspace_id', ws).eq('active', true).eq('status', 'ready'),
  ]);
  return buildKnowledge(String((cfg as any)?.knowledge || ''), (docs || []) as BibleDocText[]);
});

/** The team asks the AI a question, to check it read the deck right. Nothing is stored or sent. */
export async function askBible(ws: string, question: string): Promise<{ ok: true; answer: string; model: string } | Fail> {
  const q = question.replace(/\s+/g, ' ').trim();
  if (!q) return fail(400, 'Type a question first.');
  if (q.length > 500) return fail(400, 'The question is too long.');
  try {
    const out = await askBotModel(ASK_SYSTEM(await loadKnowledge(ws)), q, { json: false });
    return { ok: true, answer: out.text.trim(), model: out.model };
  } catch (e: any) {
    return fail(502, `The AI could not answer: ${String(e?.message || e).slice(0, 160)}`);
  }
}

// ---------------------------------------------------------------- the bot's settings (also edited here, so nobody has to open the ERP)
export interface BotSettings { enabled: boolean; persona_name: string; company_name: string; hours_from: string; hours_to: string; max_replies: number; knowledge: string }
const DEFAULTS: BotSettings = { enabled: false, persona_name: 'Fefe', company_name: 'Prof Toko Online', hours_from: '08:00', hours_to: '21:00', max_replies: 4, knowledge: '' };

export async function getSettings(ws: string): Promise<BotSettings> {
  const { data } = await createAdminClient().from('wa_bot_config').select('*').eq('workspace_id', ws).maybeSingle();
  return { ...DEFAULTS, ...Object.fromEntries(Object.entries((data as any) || {}).filter(([k]) => k in DEFAULTS)) } as BotSettings;
}

export async function saveSettings(ws: string, patch: Partial<BotSettings>): Promise<{ ok: true } | Fail> {
  const row: Record<string, unknown> = { workspace_id: ws, updated_at: new Date().toISOString() };
  const time = (v: string | undefined) => (v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : undefined);
  if (typeof patch.enabled === 'boolean') row.enabled = patch.enabled;
  if (typeof patch.persona_name === 'string') { const v = patch.persona_name.trim().slice(0, 30); if (!v) return fail(400, 'The bot needs a name.'); row.persona_name = v; }
  if (typeof patch.company_name === 'string') { const v = patch.company_name.trim().slice(0, 60); if (!v) return fail(400, 'The company name cannot be empty.'); row.company_name = v; }
  if (patch.hours_from !== undefined) { const v = time(patch.hours_from); if (!v) return fail(400, 'Opening time must look like 08:00.'); row.hours_from = v; }
  if (patch.hours_to !== undefined) { const v = time(patch.hours_to); if (!v) return fail(400, 'Closing time must look like 21:00.'); row.hours_to = v; }
  if (patch.max_replies !== undefined) { const n = Math.round(Number(patch.max_replies)); if (!(n >= 1 && n <= 10)) return fail(400, 'Messages per chat must be 1 to 10.'); row.max_replies = n; }
  if (typeof patch.knowledge === 'string') row.knowledge = patch.knowledge.slice(0, 12000);
  const { error } = await createAdminClient().from('wa_bot_config').upsert(row, { onConflict: 'workspace_id' });
  if (error) return fail(500, error.message);
  forget(`knowledge:${ws}`);
  return { ok: true };
}
