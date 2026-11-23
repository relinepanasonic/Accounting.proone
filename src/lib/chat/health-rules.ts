/**
 * Is the sales WhatsApp number delivering messages to this system? Two signs: Fonnte says the device is disconnected, or no message at all has arrived for a long
 * time in working hours. Pure, so the rule is tested. Times are Jakarta (WIB, UTC+7).
 */
export const SILENT_HOURS = 6;               // working hours without a single incoming message, before we worry
export const WORK_FROM = 8;
export const WORK_TO = 20;

const jkt = (d: Date) => new Date(d.getTime() + 7 * 3600000);
/** Monday to Saturday, 08:00 to 20:00 WIB. */
export function workingHours(now: Date): boolean {
  const j = jkt(now); const h = j.getUTCHours(); const dow = j.getUTCDay();
  return dow !== 0 && h >= WORK_FROM && h < WORK_TO;
}

export interface Health { ok: boolean; reason: 'disconnected' | 'silent' | null; silentHours: number | null; text: string }

export function healthOf(i: { now: Date; lastIncomingAt: string | null; deviceStatus: string | null }): Health {
  const silentHours = i.lastIncomingAt ? Math.max(0, (i.now.getTime() - new Date(i.lastIncomingAt).getTime()) / 3600000) : null;
  if (i.deviceStatus && i.deviceStatus.startsWith('disconnect')) {
    return { ok: false, reason: 'disconnected', silentHours, text: 'The sales WhatsApp number is DISCONNECTED in Fonnte, so no new message reaches the app. Open Fonnte, press Reconnect on the device and scan the QR code with the sales phone.' };
  }
  if (workingHours(i.now) && (silentHours === null || silentHours >= SILENT_HOURS)) {
    const h = silentHours === null ? null : Math.floor(silentHours);
    return { ok: false, reason: 'silent', silentHours, text: `No new WhatsApp message has reached the app for ${h === null ? 'a long time' : h >= 48 ? `${Math.floor(h / 24)} days` : `${h} hours`}. If people did write, the sales number is not delivering: check the device in Fonnte (connected, webhook on, Group and Personal on).` };
  }
  return { ok: true, reason: null, silentHours, text: '' };
}
