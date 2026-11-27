import { createAdminClient } from '@/lib/api/supabase-admin';
import { fetchDeviceStatus } from '@/lib/wa/fonnte-device';
import { alertPeople } from '@/lib/wa/team-alerts';
import { memo } from './cache';
import { DEVICE_LABEL, healthOf, shouldAlert, type DeviceRole, type Health } from './health-rules';

/**
 * Are our WhatsApp numbers delivering? Fefe (the sales number) and Oli (the admin number) are each asked from Fonnte whether the device is connected; the sales
 * number is also judged by silence. The dashboard shows a red bar, and Nico and Herlan get a WhatsApp: the alert about one number is sent FROM THE OTHER
 * number (a disconnected number cannot send). A problem that is not fixed is told again every 12 hours.
 */
export interface DeviceHealth extends Health { role: DeviceRole; label: string; deviceStatus: string | null; deviceError: string | null; lastIncomingAt: string | null }
export interface HealthReport extends Health { deviceStatus: string | null; deviceError: string | null; lastIncomingAt: string | null; devices: DeviceHealth[] }

const TOKEN: Record<DeviceRole, () => string | undefined> = { sales: () => process.env.FONNTE_TOKEN_SALES, admin: () => process.env.FONNTE_TOKEN };

async function devicesOf(ws: string): Promise<Array<{ id: string; phone: string; role: DeviceRole }>> {
  const { data } = await createAdminClient().from('wa_devices').select('id, phone, role').eq('workspace_id', ws).eq('active', true).in('role', ['sales', 'admin']);
  return ((data || []) as Array<{ id: string; phone: string; role: DeviceRole }>).filter((d) => !/^(ig|fb):/.test(d.phone));
}

async function compute(ws: string, now: Date): Promise<HealthReport> {
  const db = createAdminClient();
  const devs = await devicesOf(ws);
  const out: DeviceHealth[] = [];
  for (const role of ['sales', 'admin'] as DeviceRole[]) {
    const mine = devs.filter((d) => d.role === role);
    if (!mine.length) continue;
    let lastIncomingAt: string | null = null;
    if (role === 'sales') {
      const { data } = await db.from('wa_webhook_log').select('received_at').in('device_id', mine.map((d) => d.id)).order('received_at', { ascending: false }).limit(1).maybeSingle();
      lastIncomingAt = ((data as any)?.received_at ?? null) as string | null;
    }
    const dev = await fetchDeviceStatus({ token: TOKEN[role]() });
    const deviceStatus = dev.ok ? dev.status : null;
    out.push({ ...healthOf({ now, lastIncomingAt, deviceStatus, role }), role, label: DEVICE_LABEL[role], deviceStatus, deviceError: dev.ok ? null : dev.error, lastIncomingAt });
  }
  const bad = out.filter((d) => !d.ok);
  const sales = out.find((d) => d.role === 'sales');
  return {
    ok: bad.length === 0, reason: bad[0]?.reason ?? null, silentHours: sales?.silentHours ?? null, text: bad.map((d) => d.text).join(' '),
    deviceStatus: sales?.deviceStatus ?? null, deviceError: sales?.deviceError ?? null, lastIncomingAt: sales?.lastIncomingAt ?? null, devices: out,
  };
}

/** For the dashboard: cached for one minute. */
export const loadHealth = (ws: string): Promise<HealthReport> => memo(`health:${ws}`, 60_000, () => compute(ws, new Date()));

/**
 * The clock: every 10 minutes each number is checked; a problem is told to Nico and Herlan by WhatsApp from the other number, and again every 12 hours while it
 * lasts. Returns how many alerts were sent. Never throws.
 */
export async function runHealthWatch(now = new Date()): Promise<number> {
  try {
    if (now.getUTCMinutes() % 10 !== 0) return 0;
    const db = createAdminClient();
    const { data: cfgs } = await db.from('wa_bot_config').select('workspace_id, health_alerts').limit(20);
    let sent = 0;
    for (const c of (cfgs || []) as Array<{ workspace_id: string; health_alerts: Record<string, string> | null }>) {
      const alerts = { ...(c.health_alerts || {}) };
      const report = await compute(c.workspace_id, now);
      let changed = false;
      for (const d of report.devices) {
        if (d.ok) {
          if (alerts[d.role]) {                                                                          // it was down and is fine again: say so once
            const other = report.devices.find((x) => x.role !== d.role);
            const token = TOKEN[d.role === 'sales' ? 'admin' : 'sales']();
            if (token && !(other && !other.ok && other.reason === 'disconnected')) await alertPeople(c.workspace_id, ['Nico', 'Herlan'], `Fefe: ${d.label} is connected again and delivering.`, { token });
            delete alerts[d.role]; changed = true;
          }
          continue;
        }
        if (!shouldAlert(true, alerts[d.role], now)) continue;
        // the OTHER number sends the alert; if that one is down too, nothing can be sent (the red bar still shows)
        const other = report.devices.find((x) => x.role !== d.role);
        if (other && !other.ok && other.reason === 'disconnected') { console.error(`health alert for ${d.role} not sent: the other number is disconnected too`); continue; }
        const token = TOKEN[d.role === 'sales' ? 'admin' : 'sales']();
        if (!token) continue;
        const r = await alertPeople(c.workspace_id, ['Nico', 'Herlan'], `Fefe: ${d.text}`, { token });
        if (r.sent > 0) { alerts[d.role] = now.toISOString(); changed = true; sent += r.sent; }
      }
      if (changed) await db.from('wa_bot_config').update({ health_alerts: alerts }).eq('workspace_id', c.workspace_id);
    }
    return sent;
  } catch (e) { console.error('health watch failed', e); return 0; }
}
