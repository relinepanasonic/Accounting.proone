import { createAdminClient } from '@/lib/api/supabase-admin';
import { sendWhatsApp } from './send';

/**
 * Sends one WhatsApp message to named people of the team (Nico, Herlan, Lucy): the active numbers in WA Control > Founder > Recipients whose first name
 * matches. The same numbers the BOD report goes to. Never throws: a failed alert must never undo the sales action that caused it.
 */
export async function alertPeople(workspaceId: string, firstNames: string[], text: string, opts: { token?: string } = {}): Promise<{ sent: number; to: string[] }> {
  try {
    const { data } = await createAdminClient().from('wa_recipients').select('phone, name').eq('workspace_id', workspaceId).eq('active', true);
    const want = new Set(firstNames.map((n) => n.toLowerCase()));
    const rows = ((data || []) as Array<{ phone: string; name: string | null }>).filter((r) => want.has(String(r.name || '').trim().split(/\s+/)[0].toLowerCase()));
    const phones = Array.from(new Set(rows.map((r) => r.phone)));
    if (!phones.length) return { sent: 0, to: [] };
    const r = await sendWhatsApp(phones, text, opts.token ? { token: opts.token } : {});
    if (!r.ok) console.error('team alert failed', r.detail);
    return { sent: r.ok ? phones.length : 0, to: rows.map((x) => String(x.name || x.phone)) };
  } catch (e) { console.error('team alert failed', e); return { sent: 0, to: [] }; }
}
