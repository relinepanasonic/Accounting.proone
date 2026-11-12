/**
 * The sales bot's rules, as pure functions (no database, no network), so every rule is tested.
 * The bot only ever answers a PRIVATE chat on a number whose role is "sales", while its switch is on, and it steps back for good
 * as soon as a salesperson writes in that chat or the chat needs a person.
 */

export interface BotState { status: 'bot' | 'human' | 'off' | null; replies: number }

export interface BotInput {
  enabled: boolean;
  deviceRole: string;
  isGroup: boolean;
  /** The message was sent by our own number (a salesperson on the phone, or the bot itself). */
  isFromMe: boolean;
  body: string | null;
  mediaType: string | null;
  state: BotState;
  maxReplies: number;
  /** For our own messages: the text matches something the bot sent a moment ago. */
  echoOfBot: boolean;
}

export type BotDecision =
  | { action: 'reply' }
  | { action: 'takeover'; reason: string }     // a salesperson wrote: the bot stops in this chat
  | { action: 'limit'; reason: string }        // the bot has said enough: a person must continue
  | { action: 'skip'; reason: string };

export function decideBot(i: BotInput): BotDecision {
  if (i.deviceRole !== 'sales') return { action: 'skip', reason: 'not-a-sales-number' };
  if (!i.enabled) return { action: 'skip', reason: 'bot-off' };
  if (i.isGroup) return { action: 'skip', reason: 'group' };
  if (i.isFromMe) {
    if (i.echoOfBot) return { action: 'skip', reason: 'own-bot-message' };
    if (i.state.status === 'human' || i.state.status === 'off') return { action: 'skip', reason: 'already-with-a-person' };
    return { action: 'takeover', reason: 'A salesperson replied.' };
  }
  if (i.state.status === 'human') return { action: 'skip', reason: 'with-a-person' };
  if (i.state.status === 'off') return { action: 'skip', reason: 'chat-off' };
  if (!(i.body || '').trim() && !i.mediaType) return { action: 'skip', reason: 'empty' };
  if (i.state.replies >= i.maxReplies) return { action: 'limit', reason: `The bot already sent ${i.maxReplies} messages.` };
  return { action: 'reply' };
}

/** Compares texts ignoring spaces and case, so a message our own number echoes back is recognised as the bot's. */
const flat = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

export function isBotEcho(body: string | null, recentReplies: string[]): boolean {
  const b = flat(body || '');
  if (!b) return false;
  return recentReplies.some((r) => {
    const x = flat(r);
    return x === b || (x.length > 20 && (x.startsWith(b) || b.startsWith(x.slice(0, 40))));
  });
}

/**
 * Words after which a person should answer, not the bot: complaints, a request for a person or a call, negotiating a price,
 * paying. Checked BEFORE the model answers, so these never depend on the model's judgment.
 */
const HUMAN_RULES: Array<[RegExp, string]> = [
  [/\b(komplain|complain|kecewa|penipu|tipu|scam|refund|ganti rugi|marah|laporin|lapor)\w*/i, 'Complaint or upset customer.'],
  [/\b(nego|tawar|diskon|potongan|kurang(in)?|harga pas|termurah|bisa murah)\w*/i, 'Price negotiation.'],
  [/\b(transfer|rekening|bayar|pembayaran|invoice|faktur|dp\b|lunas)\w*/i, 'Payment or invoice.'],
  [/\b(telp|telepon|telpon|call|nelp|nelpon|vc|video call|zoom|meet|ketemu|bertemu|datang)\w*/i, 'Wants a call or a meeting.'],
  [/\b(minta|mau|bisa|boleh)\b.{0,20}\b(bicara|ngobrol|ditelp\w*|dihubungi|sama (sales|admin|orangnya|manager|owner|bos))/i, 'Asked for a person.'],
  [/\b(sales|admin|manager|owner|bos|pak|bu)\b.{0,12}\b(nya|mana|ada)\b.{0,8}\?/i, 'Asked for a person.'],
];

export function needsHuman(text: string | null): string | null {
  const t = (text || '').trim();
  if (!t) return null;
  for (const [re, reason] of HUMAN_RULES) if (re.test(t)) return reason;
  return null;
}

/** "08:00".."21:00" in Jakarta time: is `now` inside the open hours? Handles an end before the start (overnight). */
export function inOpenHours(now: Date, from: string, to: string): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const at = h * 60 + m;
  const mins = (s: string) => { const [a, b] = s.split(':').map(Number); return (a || 0) * 60 + (b || 0); };
  const a = mins(from), b = mins(to);
  return a <= b ? at >= a && at < b : at >= a || at < b;
}
