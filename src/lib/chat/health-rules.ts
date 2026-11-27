/**
 * Is a WhatsApp number of ours delivering messages to this system? Two signs: Fonnte says the device is disconnected, or (for the sales number only) no message at
 * all has arrived for a long time in working hours. Pure, so the rule is tested. Times are Jakarta (WIB, UTC+7).
 * Two numbers are watched: Fefe (the sales number, the leads) and Oli (the admin number, the client groups and the reports).
 */
export const SILENT_HOURS = 6;               // working hours without a single incoming message on the sales number, before we worry
export const WORK_FROM = 8;
export const WORK_TO = 20;
export const REPEAT_HOURS = 12;              // a problem that is not fixed is told again every 12 hours

const jkt = (d: Date) => new Date(d.getTime() + 7 * 3600000);
/** Monday to Saturday, 08:00 to 20:00 WIB. */
export function workingHours(now: Date): boolean {
  const j = jkt(now); const h = j.getUTCHours(); const dow = j.getUTCDay();
  return dow !== 0 && h >= WORK_FROM && h < WORK_TO;
}

export type DeviceRole = 'sales' | 'admin';
/** How the team calls each number. */
export const DEVICE_LABEL: Record<DeviceRole, string> = { sales: 'Fefe (the sales number)', admin: 'Oli (the admin number)' };

export interface Health { ok: boolean; reason: 'disconnected' | 'silent' | null; silentHours: number | null; text: string }

export function healthOf(i: { now: Date; lastIncomingAt: string | null; deviceStatus: string | null; role?: DeviceRole }): Health {
  const role = i.role ?? 'sales';
  const label = DEVICE_LABEL[role];
  const silentHours = i.lastIncomingAt ? Math.max(0, (i.now.getTime() - new Date(i.lastIncomingAt).getTime()) / 3600000) : null;
  if (i.deviceStatus && i.deviceStatus.startsWith('disconnect')) {
    return { ok: false, reason: 'disconnected', silentHours, text: `${label} is DISCONNECTED in Fonnte, so ${role === 'sales' ? 'no new chat reaches the dashboard' : 'no group message or report goes through this number'}. Open Fonnte, press Connect on the device and scan the QR code with that phone.` };
  }
  // only the sales number is judged by silence: its chats are the leads
  if (role === 'sales' && workingHours(i.now) && (silentHours === null || silentHours >= SILENT_HOURS)) {
    const h = silentHours === null ? null : Math.floor(silentHours);
    return { ok: false, reason: 'silent', silentHours, text: `No new WhatsApp message has reached the dashboard for ${h === null ? 'a long time' : h >= 48 ? `${Math.floor(h / 24)} days` : `${h} hours`}. If people did write, ${label} is not delivering: check the device in Fonnte (connected, webhook on, Group and Personal on).` };
  }
  return { ok: true, reason: null, silentHours, text: '' };
}

/** Should the team be told now: there is a problem, and it was not told in the last REPEAT_HOURS hours. */
export function shouldAlert(problem: boolean, lastAlertAt: string | null | undefined, now: Date): boolean {
  if (!problem) return false;
  if (!lastAlertAt) return true;
  return now.getTime() - new Date(lastAlertAt).getTime() >= REPEAT_HOURS * 3600000;
}
