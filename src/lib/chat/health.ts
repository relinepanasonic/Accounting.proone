import { createAdminClient } from '@/lib/api/supabase-admin';
import { fetchDeviceStatus } from '@/lib/wa/fonnte-device';
import { alertPeople } from '@/lib/wa/team-alerts';
import { memo } from './cache';
import { healthOf, type Health } from './health-rules';

/**
 * Is the sales WhatsApp number delivering messages? The dashboard shows a red bar when it is not, and Nico and Herlan get a WhatsApp from the OTHER number (the
 * admin one) at most once every 12 hours. The check asks Fonnte whether the device is connected and looks at when the last message arrived.
 */
export interface HealthReport extends Health { deviceStatus: string | null; deviceError: string | null; lastIncomingAt: string | null }

async function salesDeviceIds(ws: string): Promise<string[]> {
  const { data } = await createAdminClient().from('wa_devices').select('id, phone').eq('workspace_id', ws).eq('role', 'sales').eq('active', true);
  return ((data || []) as Array<{ id: string; phone: string }>).filter((d) => !/^(ig|fb):/.test(d.phone)).map((d) => d.id);
}

async function compute(ws: string, now: Date): Promise<HealthReport> {
  const ids = await salesDeviceIds(ws);
  if (!ids.length) return { ok: true, reason: null, silentHours: null, text: '', deviceStatus: null, deviceError: null, lastIncomingAt: null };
  const db = createAdminClient();
  const { data } = await db.from('wa_webhook_log').select('received_at').in('device_id', ids).order('received_at', { ascending: false }).limit(1).maybeSingle();
  const lastIncomingAt = ((data as any)?.received_at ?? null) as string | null;
  const dev = await fetchDeviceStatus();
  const deviceStatus = dev.ok ? dev.status : null;
  return { ...healthOf({ now, lastIncomingAt, deviceStatus }), deviceStatus, deviceError: dev.ok ? null : dev.error, lastIncomingAt };
}

/** For the dashboard: cached for one minute. */
export const loadHealth = (ws: string): Promise<HealthReport> => memo(`health:${ws}`, 60_000, () => compute(ws, new Date()));

/** The clock: every 10 minutes, a problem is told to Nico and Herlan by WhatsApp (not more than once in 12 hours). Returns how many alerts were sent. Never throws. */
export async function runHealthWatch(now = new Date()): Promise<number> {
  try {
    if (now.getUTCMinutes() % 10 !== 0) return 0;
    const db = createAdminClient();
    const { data: cfgs } = await db.from('wa_bot_config').select('workspace_id, health_alert_at').limit(20);
    let sent = 0;
    for (const c of (cfgs || []) as Array<{ workspace_id: string; health_alert_at: string | null }>) {
      if (c.health_alert_at && now.getTime() - new Date(c.health_alert_at).getTime() < 12 * 3600000) continue;
      const h = await compute(c.workspace_id, now);
      if (h.ok) continue;
      const { data: claimed } = await db.from('wa_bot_config').update({ health_alert_at: now.toISOString() }).eq('workspace_id', c.workspace_id).select('workspace_id');
      if (!claimed?.length) continue;
      const r = await alertPeople(c.workspace_id, ['Nico', 'Herlan'], `Fefe: ${h.text}`);
      sent += r.sent;
    }
    return sent;
  } catch (e) { console.error('health watch failed', e); return 0; }
}
