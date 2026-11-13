/**
 * The chat dashboard's view of the sales number's private chats. Pure functions (rows in, shapes out), so the rules are tested.
 * A chat is "unserved" when the lead wrote last and nobody (person or bot) has answered since.
 */

export interface ChatGroupRow { id: string; wa_id: string; name: string | null; last_message_at: string | null }
export interface ChatMessageRow { id: string; group_id: string; body: string | null; media_type: string | null; is_from_me: boolean; sent_at: string; source?: string | null; raw?: any }
export interface BotChatRow { group_id: string; status: 'bot' | 'human' | 'off'; replies: number; reason: string | null; lead: { name?: string; store?: string; need?: string } | null }

export type ChatStatus = 'bot' | 'human' | 'off' | 'new';
export type ChatFilter = 'all' | 'unserved' | 'bot' | 'human';

export interface ConversationSummary {
  id: string; phone: string; name: string; initials: string;
  lastText: string; lastAt: string | null; lastFromMe: boolean;
  unserved: boolean; status: ChatStatus; lead: BotChatRow['lead']; botReplies: number;
}

export const previewOf = (m: Pick<ChatMessageRow, 'body' | 'media_type'>): string => {
  const t = (m.body || '').replace(/\s+/g, ' ').trim();
  if (t) return t.length > 90 ? `${t.slice(0, 87).trimEnd()}...` : t;
  return m.media_type ? `(${m.media_type})` : '';
};

export const initialsOf = (name: string): string => {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '#';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
};

/** "628972341717" -> "+62 897-2341-717" is not worth guessing: show it as +62... digits. */
export const phoneLabel = (waId: string) => `+${waId}`;

export function conversationsOf(groups: ChatGroupRow[], messages: ChatMessageRow[], botChats: BotChatRow[]): ConversationSummary[] {
  const lastBy = new Map<string, ChatMessageRow>();
  for (const m of messages) {                                  // messages may come in any order
    const cur = lastBy.get(m.group_id);
    if (!cur || m.sent_at > cur.sent_at) lastBy.set(m.group_id, m);
  }
  const bot = new Map(botChats.map((b) => [b.group_id, b]));
  const out: ConversationSummary[] = groups.map((g) => {
    const last = lastBy.get(g.id);
    const b = bot.get(g.id);
    const name = (g.name || '').trim() || phoneLabel(g.wa_id);
    return {
      id: g.id, phone: g.wa_id, name, initials: initialsOf(g.name || ''),
      lastText: last ? previewOf(last) : '', lastAt: last?.sent_at ?? g.last_message_at, lastFromMe: !!last?.is_from_me,
      unserved: !!last && !last.is_from_me,
      status: b?.status ?? 'new', lead: b?.lead ?? null, botReplies: b?.replies ?? 0,
    };
  });
  return out.sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')));
}

export function filterConversations(list: ConversationSummary[], filter: ChatFilter, q: string): ConversationSummary[] {
  const needle = q.trim().toLowerCase();
  return list.filter((c) => {
    if (filter === 'unserved' && !c.unserved) return false;
    if (filter === 'bot' && c.status !== 'bot') return false;
    if (filter === 'human' && c.status !== 'human') return false;
    if (!needle) return true;
    return [c.name, c.phone, c.lastText, c.lead?.name, c.lead?.store, c.lead?.need].some((v) => String(v || '').toLowerCase().includes(needle));
  });
}

export const countsOf = (list: ConversationSummary[]) => ({
  all: list.length,
  unserved: list.filter((c) => c.unserved).length,
  bot: list.filter((c) => c.status === 'bot').length,
  human: list.filter((c) => c.status === 'human').length,
});

export type Sender = 'lead' | 'bot' | 'team';
export interface ThreadMessage { id: string; sender: Sender; senderName: string | null; text: string; mediaType: string | null; at: string }

/**
 * Who wrote each message: the lead, the bot (our own message that matches something the bot logged), or a person (the dashboard user,
 * or someone on the phone). `botReplies` are the texts in wa_bot_log.
 */
export function threadOf(messages: ChatMessageRow[], botReplies: string[]): ThreadMessage[] {
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const bot = new Set(botReplies.map(flat));
  return [...messages].sort((a, b) => a.sent_at.localeCompare(b.sent_at)).map((m) => {
    const text = (m.body || '').trim();
    const by = m.raw?.sentBy?.name ? String(m.raw.sentBy.name) : null;
    const sender: Sender = !m.is_from_me ? 'lead' : bot.has(flat(text)) && !by ? 'bot' : 'team';
    return { id: m.id, sender, senderName: sender === 'team' ? by : null, text, mediaType: m.media_type, at: m.sent_at };
  });
}
