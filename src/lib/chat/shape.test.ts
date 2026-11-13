import { describe, it, expect } from 'vitest';
import { conversationsOf, countsOf, filterConversations, initialsOf, threadOf, type BotChatRow, type ChatGroupRow, type ChatMessageRow } from './shape';

const g = (id: string, name: string | null, wa = '628111'): ChatGroupRow => ({ id, wa_id: wa + id, name, last_message_at: null });
const m = (id: string, group: string, at: string, fromMe: boolean, body = 'x', extra: Partial<ChatMessageRow> = {}): ChatMessageRow => ({ id, group_id: group, body, media_type: null, is_from_me: fromMe, sent_at: at, ...extra });

describe('conversationsOf', () => {
  const groups = [g('a', 'Budi Santoso'), g('b', null), g('c', 'Sari')];
  const msgs = [
    m('1', 'a', '2026-11-13T04:00:00Z', false, 'Halo kak'), m('2', 'a', '2026-11-13T04:01:00Z', true, 'Hi kak, Fefe disini'),
    m('3', 'b', '2026-11-13T05:00:00Z', false, 'info paket'),
    m('4', 'c', '2026-11-13T03:00:00Z', false, 'tanya harga'), m('5', 'c', '2026-11-13T03:05:00Z', false, 'halo?'),
  ];
  const bot: BotChatRow[] = [{ group_id: 'a', status: 'bot', replies: 1, reason: null, lead: { name: 'Budi' } }, { group_id: 'c', status: 'human', replies: 0, reason: 'x', lead: null }];

  it('sorts by the latest message, takes the last message of each chat and says who wrote it', () => {
    const list = conversationsOf(groups, msgs, bot);
    expect(list.map((c) => c.id)).toEqual(['b', 'a', 'c']);
    expect(list.find((c) => c.id === 'a')).toMatchObject({ lastText: 'Hi kak, Fefe disini', lastFromMe: true, unserved: false, status: 'bot', botReplies: 1 });
  });
  it('a chat where the lead wrote last is unserved; a chat the bot has not touched is "new"; no name falls back to the number', () => {
    const list = conversationsOf(groups, msgs, bot);
    const b = list.find((c) => c.id === 'b')!;
    expect(b).toMatchObject({ unserved: true, status: 'new', name: '+628111b' });
    expect(list.find((c) => c.id === 'c')!.unserved).toBe(true);
  });
  it('filters by tab and by a search over name, number, last text and lead details; counts per tab', () => {
    const list = conversationsOf(groups, msgs, bot);
    expect(countsOf(list)).toEqual({ all: 3, unserved: 2, bot: 1, human: 1 });
    expect(filterConversations(list, 'unserved', '').map((c) => c.id).sort()).toEqual(['b', 'c']);
    expect(filterConversations(list, 'bot', '').map((c) => c.id)).toEqual(['a']);
    expect(filterConversations(list, 'all', 'budi').map((c) => c.id)).toEqual(['a']);
    expect(filterConversations(list, 'all', 'halo?').map((c) => c.id)).toEqual(['c']);      // the last message of that chat
  });
  it('a media-only message shows its type; long text is cut', () => {
    const list = conversationsOf([g('a', 'X')], [m('1', 'a', '2026-11-13T04:00:00Z', false, '', { media_type: 'image' })], []);
    expect(list[0].lastText).toBe('(image)');
    expect(conversationsOf([g('a', 'X')], [m('1', 'a', '2026-11-13T04:00:00Z', false, 'k'.repeat(200))], [])[0].lastText.length).toBeLessThanOrEqual(90);
  });
});

describe('initialsOf', () => {
  it('two letters from a name, with a fallback', () => {
    expect(initialsOf('Budi Santoso')).toBe('BS');
    expect(initialsOf('Sari')).toBe('SA');
    expect(initialsOf('')).toBe('#');
    expect(initialsOf('😀')).toBe('#');
  });
});

describe('threadOf', () => {
  it('marks our own messages as the bot when they match the bot log, as a person otherwise (with the dashboard user name)', () => {
    const t = threadOf([
      m('3', 'a', '2026-11-13T04:03:00Z', true, 'Saya Rani dari tim', { raw: { sentBy: { name: 'Rani' } } }),
      m('1', 'a', '2026-11-13T04:00:00Z', false, 'Halo'),
      m('2', 'a', '2026-11-13T04:01:00Z', true, 'Hi kak,  Fefe disini'),
      m('4', 'a', '2026-11-13T04:04:00Z', true, 'dari hp'),
    ], ['hi kak, fefe disini']);
    expect(t.map((x) => [x.id, x.sender, x.senderName])).toEqual([['1', 'lead', null], ['2', 'bot', null], ['3', 'team', 'Rani'], ['4', 'team', null]]);
  });
});
