import { chatLabel } from './channel';
/**
 * The chat dashboard's view of the sales number's private chats. Pure functions (rows in, shapes out), so the rules are tested.
 * A chat is "unserved" when the lead wrote last and nobody (person or bot) has answered since; "waiting since" is when that run of lead messages began.
 * A chat is "resolved" when someone marked it so and the lead has not written since (a new message from the lead reopens it).
 */

export interface ChatGroupRow { id: string; wa_id: string; name: string | null; last_message_at: string | null }
export interface ChatMessageRow { id: string; group_id: string; body: string | null; media_type: string | null; is_from_me: boolean; sent_at: string; source?: string | null; raw?: any }
export interface BotChatRow { group_id: string; status: 'bot' | 'human' | 'off'; replies: number; reason: string | null; lead: { name?: string; store?: string; need?: string } | null }
export interface ChatStateRow { group_id: string; assigned_to: string | null; assigned_name: string | null; resolved_at: string | null; first_message?: string | null; source_label?: string | null; source_channel?: string | null; source_by?: string | null }
export interface ChatSource { label: string | null; channel: string; by: string | null }
export interface ChatNoteRow { id: string; group_id: string; author_name: string; body: string; created_at: string }

export type ChatStatus = 'bot' | 'human' | 'off' | 'new';
export type ChatFilter = 'all' | 'mine' | 'unserved' | 'bot' | 'human' | 'resolved' | 'followup';
export interface ChatLabel { id: string; name: string; color: string }
export interface NextReminder { id: string; dueAt: string; note: string | null; state: 'overdue' | 'today' | 'later' }

export interface ConversationSummary {
  id: string; phone: string; name: string; initials: string;
  lastText: string; lastAt: string | null; lastFromMe: boolean;
  unserved: boolean; waitingSince: string | null;
  status: ChatStatus; lead: BotChatRow['lead']; botReplies: number;
  assignedTo: { id: string; name: string } | null; resolved: boolean;
  source: ChatSource | null;
  /** Filled by the server after the fact (labels on the chat, its next open reminder). */
  labels?: ChatLabel[];
  nextReminder?: NextReminder | null;
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

export const phoneLabel = (waId: string) => chatLabel(waId);

/** Where the lead came from, as the inbox shows it; null until a first message was recorded. */
export function sourceOf(st?: Pick<ChatStateRow, 'first_message' | 'source_label' | 'source_channel' | 'source_by'> | null): ChatSource | null {
  if (!st || (!st.first_message && !st.source_channel)) return null;
  return { label: st.source_label ?? null, channel: st.source_channel || 'unknown', by: st.source_by && st.source_by !== 'auto' ? st.source_by : null };
}

export function conversationsOf(groups: ChatGroupRow[], messages: ChatMessageRow[], botChats: BotChatRow[], states: ChatStateRow[] = []): ConversationSummary[] {
  const byGroup = new Map<string, ChatMessageRow[]>();
  for (const m of messages) { const l = byGroup.get(m.group_id) || []; l.push(m); byGroup.set(m.group_id, l); }
  const bot = new Map(botChats.map((b) => [b.group_id, b]));
  const state = new Map(states.map((s) => [s.group_id, s]));

  const out: ConversationSummary[] = groups.map((g) => {
    const list = (byGroup.get(g.id) || []).sort((a, b) => b.sent_at.localeCompare(a.sent_at));    // newest first
    const last = list[0];
    const b = bot.get(g.id);
    const st = state.get(g.id);
    const name = (g.name || '').trim() || phoneLabel(g.wa_id);

    // the run of lead messages after our last message: its oldest one is when the lead started waiting
    let waitingSince: string | null = null;
    for (const m of list) { if (m.is_from_me) break; waitingSince = m.sent_at; }
    const lastLead = list.find((m) => !m.is_from_me);
    const resolved = !!st?.resolved_at && !(lastLead && lastLead.sent_at > st.resolved_at);

    return {
      id: g.id, phone: g.wa_id, name, initials: initialsOf(g.name || ''),
      lastText: last ? previewOf(last) : '', lastAt: last?.sent_at ?? g.last_message_at, lastFromMe: !!last?.is_from_me,
      unserved: !!last && !last.is_from_me, waitingSince: last && !last.is_from_me ? waitingSince : null,
      status: b?.status ?? 'new', lead: b?.lead ?? null, botReplies: b?.replies ?? 0,
      assignedTo: st?.assigned_to ? { id: st.assigned_to, name: st.assigned_name || 'Team' } : null, resolved,
      source: sourceOf(st),
    };
  });
  return out.sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')));
}

export function filterConversations(list: ConversationSummary[], filter: ChatFilter, q: string, meId = ''): ConversationSummary[] {
  const needle = q.trim().toLowerCase();
  return list.filter((c) => {
    if (filter === 'resolved') { if (!c.resolved) return false; }
    else {
      if (c.resolved) return false;                                  // every other tab shows open chats only
      if (filter === 'mine' && (!meId || c.assignedTo?.id !== meId)) return false;
      if (filter === 'unserved' && !c.unserved) return false;
      if (filter === 'bot' && c.status !== 'bot') return false;
      if (filter === 'human' && c.status !== 'human') return false;
      if (filter === 'followup' && !(c.nextReminder && c.nextReminder.state !== 'later')) return false;
    }
    if (!needle) return true;
    return [c.name, c.phone, c.lastText, c.lead?.name, c.lead?.store, c.lead?.need, c.assignedTo?.name, ...(c.labels || []).map((l) => l.name)].some((v) => String(v || '').toLowerCase().includes(needle));
  });
}

export const countsOf = (list: ConversationSummary[], meId = '') => {
  const open = list.filter((c) => !c.resolved);
  return {
    all: open.length,
    mine: meId ? open.filter((c) => c.assignedTo?.id === meId).length : 0,
    unserved: open.filter((c) => c.unserved).length,
    bot: open.filter((c) => c.status === 'bot').length,
    human: open.filter((c) => c.status === 'human').length,
    resolved: list.length - open.length,
    followup: open.filter((c) => c.nextReminder && c.nextReminder.state !== 'later').length,
  };
};

export type Sender = 'lead' | 'bot' | 'team' | 'note';
export interface ThreadMessage { id: string; sender: Sender; senderName: string | null; text: string; mediaType: string | null; at: string; mediaUrl?: string | null }

/**
 * Who wrote each message: the lead, the bot (our own message that matches something the bot logged), a person (the dashboard user,
 * or someone on the phone), or an internal note (never sent to the lead). `botReplies` are the texts in wa_bot_log.
 */
export function threadOf(messages: ChatMessageRow[], botReplies: string[], notes: ChatNoteRow[] = []): ThreadMessage[] {
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const bot = new Set(botReplies.map(flat));
  const chat: ThreadMessage[] = messages.map((m) => {
    const text = (m.body || '').trim();
    const by = m.raw?.sentBy?.name ? String(m.raw.sentBy.name) : null;
    const sender: Sender = !m.is_from_me ? 'lead' : (m.raw?.bot === true || bot.has(flat(text))) && !by ? 'bot' : 'team';
    return { id: m.id, sender, senderName: sender === 'team' ? by : null, text, mediaType: m.media_type, at: m.sent_at };
  });
  const internal: ThreadMessage[] = notes.map((n) => ({ id: `note:${n.id}`, sender: 'note', senderName: n.author_name, text: n.body, mediaType: null, at: n.created_at }));
  return [...chat, ...internal].sort((a, b) => a.at.localeCompare(b.at));
}

/** Slash shortcut: "/harga" -> "harga". Lower case letters, digits, dash and underscore only, up to 24 characters; null when there is nothing usable. */
export function cleanShortcut(raw: string): string | null {
  const s = String(raw || '').trim().replace(/^\/+/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return s ? s.slice(0, 24) : null;
}
