/**
 * The state of a Fonnte device, asked from Fonnte (API Device Profile: POST https://api.fonnte.com/device with the device token, answer with "device_status":
 * "connect" or "disconnect"). Server-side only. Used to tell the team, at once, when the sales number stopped delivering messages.
 */
export const FONNTE_DEVICE_URL = 'https://api.fonnte.com/device';

export type DeviceStatus = { ok: true; status: string } | { ok: false; error: string };

export async function fetchDeviceStatus(opts: { token?: string; fetchImpl?: typeof fetch } = {}): Promise<DeviceStatus> {
  const token = opts.token ?? process.env.FONNTE_TOKEN_SALES;
  if (!token) return { ok: false, error: 'The sales number token is not set on the server.' };
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(FONNTE_DEVICE_URL, { method: 'POST', headers: { Authorization: token }, signal: AbortSignal.timeout(10000) });
    let json: any = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    if (!json || json.status === false || json.Status === false) return { ok: false, error: String(json?.reason || json?.detail || `HTTP ${res.status}`) };
    const status = String(json.device_status ?? json.deviceStatus ?? '').toLowerCase().trim();
    return status ? { ok: true, status } : { ok: false, error: 'Fonnte did not say the status of the device.' };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'TimeoutError' ? 'Fonnte took too long to answer.' : `Could not reach Fonnte: ${e?.message || e}` };
  }
}
