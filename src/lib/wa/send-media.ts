import { sendWhatsApp, type SendResult } from './send';

/**
 * Sends an image (or a PDF) to WhatsApp through Fonnte, in one of two ways:
 *  - "link": the file is stored, and Fonnte is given a short-lived link to fetch it. Fonnte then sends it like a normal image from a link, and
 *    WhatsApp can show the small blurred preview before the download (a file uploaded straight to Fonnte arrives without that preview: you see a
 *    grey box with a download arrow).
 *  - "upload": the file itself is sent to Fonnte (multipart). It always works, but the chat shows the grey box.
 * "link" is the default. If Fonnte cannot use the link, the same message is sent as an upload, so a report is never lost to this choice.
 * Pure: the storage is passed in (the server gives it Supabase Storage), so it can be tested.
 */

export interface MediaStorage {
  /** Stores the file; true when it is stored. */
  upload(path: string, data: Uint8Array, contentType: string): Promise<boolean>;
  /** A public link to the stored file that works for `seconds`; null when none can be made. */
  signedUrl(path: string, seconds: number): Promise<string | null>;
}
export type Delivery = 'link' | 'upload';
export const asDelivery = (v: unknown): Delivery => (v === 'upload' ? 'upload' : 'link');

/** Fonnte's complaints that mean "I could not use that link" (as opposed to a refused token or a bad number). */
const LINK_PROBLEM = /url|unreachable|format|file/i;

export async function sendMedia(o: {
  phones: string[]; caption: string; data: Uint8Array; filename: string; contentType: string;
  path: string; delivery: Delivery; storage: MediaStorage; token?: string; fetchImpl?: typeof fetch;
}): Promise<SendResult & { mode: Delivery; stored: boolean }> {
  const stored = await o.storage.upload(o.path, o.data, o.contentType).catch(() => false);
  const common = { token: o.token, fetchImpl: o.fetchImpl };

  if (o.delivery === 'link' && stored) {
    const url = await o.storage.signedUrl(o.path, 3600).catch(() => null);
    if (url) {
      const r = await sendWhatsApp(o.phones, o.caption, { ...common, file: { url, filename: o.filename } });
      if (r.ok || !LINK_PROBLEM.test(r.detail)) return { ...r, mode: 'link', stored };
      // Fonnte could not use the link: the same message goes out as an upload below
    }
  }
  const r = await sendWhatsApp(o.phones, o.caption, { ...common, file: { data: o.data, filename: o.filename, contentType: o.contentType } });
  return { ...r, mode: 'upload', stored };
}
