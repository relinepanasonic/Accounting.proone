/**
 * The sales deck as a link (Google Drive): the regular Fonnte package cannot send files, so the bot sends the link to the deck instead.
 * Pure, so it is tested. The link is set in AI Kamus > Bot script & settings.
 */

/** Only an https link (Google Drive, Docs, or another https page); anything else counts as no deck. */
export function validDeckUrl(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s || s.length > 500 || /\s/.test(s)) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && u.hostname.includes('.') ? u.toString() : null;
  } catch { return null; }
}

/** The bot's reply with the deck link under it. */
export const deckLine = (reply: string, url: string) => `${reply.trim()}\n\nDeck Prof Toko Online: ${url}`;
