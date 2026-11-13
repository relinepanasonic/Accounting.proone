import { describe, it, expect } from 'vitest';
import { cleanShortcut, conversationsOf, countsOf, filterConversations, initialsOf, threadOf, type BotChatRow, type ChatGroupRow, type ChatMessageRow, type ChatStateRow } from './shape';

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
    expect(countsOf(list)).toEqual({ all: 3, mine: 0, unserved: 2, bot: 1, human: 1, resolved: 0, followup: 0 });
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

describe('batch 1: waiting time, assignment, resolved', () => {
  const groups = [g('a', 'Budi'), g('b', 'Sari'), g('c', 'Dian')];
  const msgs = [
    // Budi wrote 3 times after our last message: he has waited since the first of those
    m('1', 'a', '2026-11-13T04:00:00Z', false, 'halo'), m('2', 'a', '2026-11-13T04:02:00Z', true, 'hi kak'),
    m('3', 'a', '2026-11-13T04:10:00Z', false, 'mau tanya'), m('4', 'a', '2026-11-13T04:11:00Z', false, 'paket'), m('5', 'a', '2026-11-13T04:12:00Z', false, 'berapa'),
    m('6', 'b', '2026-11-13T03:00:00Z', false, 'info'), m('7', 'b', '2026-11-13T03:01:00Z', true, 'siap kak'),
    m('8', 'c', '2026-11-13T02:00:00Z', false, 'ok makasih'),
  ];
  const states: ChatStateRow[] = [
    { group_id: 'a', assigned_to: 'u1', assigned_name: 'Rani', resolved_at: null },
    { group_id: 'b', assigned_to: 'u2', assigned_name: 'Lucy', resolved_at: '2026-11-13T03:30:00Z' },    // resolved, and the lead has not written since
    { group_id: 'c', assigned_to: null, assigned_name: null, resolved_at: '2026-11-13T01:00:00Z' },        // marked resolved, but the lead wrote after: open again
  ];
  const list = conversationsOf(groups, msgs, [], states);
  const by = (id: string) => list.find((c) => c.id === id)!;

  it('waitingSince is when the current run of unanswered lead messages began, and only for unserved chats', () => {
    expect(by('a').waitingSince).toBe('2026-11-13T04:10:00Z');
    expect(by('b').waitingSince).toBeNull();
    expect(by('c').waitingSince).toBe('2026-11-13T02:00:00Z');
  });
  it('carries who handles the chat; a chat is resolved only while the lead has not written since', () => {
    expect(by('a').assignedTo).toEqual({ id: 'u1', name: 'Rani' });
    expect(by('c').assignedTo).toBeNull();
    expect(by('b').resolved).toBe(true);
    expect(by('c').resolved).toBe(false);
  });
  it('tabs: every tab but Resolved shows open chats; Mine is the chats assigned to me; counts follow', () => {
    expect(filterConversations(list, 'all', '').map((c) => c.id).sort()).toEqual(['a', 'c']);
    expect(filterConversations(list, 'mine', '', 'u1').map((c) => c.id)).toEqual(['a']);
    expect(filterConversations(list, 'mine', '', '').length).toBe(0);
    expect(filterConversations(list, 'resolved', '').map((c) => c.id)).toEqual(['b']);
    expect(filterConversations(list, 'all', 'rani').map((c) => c.id)).toEqual(['a']);          // search finds the assignee
    expect(countsOf(list, 'u1')).toMatchObject({ all: 2, mine: 1, unserved: 2, resolved: 1 });
  });
});

describe('internal notes in the thread', () => {
  it('shows notes in time order among the messages, marked as notes with their author', () => {
    const t = threadOf(
      [m('1', 'a', '2026-11-13T04:00:00Z', false, 'halo'), m('2', 'a', '2026-11-13T04:05:00Z', true, 'hi kak')],
      [],
      [{ id: 'n1', group_id: 'a', author_name: 'Rani', body: 'Minta telepon besok', created_at: '2026-11-13T04:02:00Z' }],
    );
    expect(t.map((x) => [x.sender, x.text])).toEqual([['lead', 'halo'], ['note', 'Minta telepon besok'], ['team', 'hi kak']]);
    expect(t[1].senderName).toBe('Rani');
  });
});

describe('cleanShortcut', () => {
  it('lower case letters, digits, dash and underscore, without the slash', () => {
    expect(cleanShortcut('/Harga Paket!')).toBe('hargapaket');
    expect(cleanShortcut('  //promo-1 ')).toBe('promo-1');
    expect(cleanShortcut('a'.repeat(40))?.length).toBe(24);
    expect(cleanShortcut('///')).toBeNull();
    expect(cleanShortcut('')).toBeNull();
  });
});

describe('messages saved by the bot or a flow', () => {
  it('a saved automatic message (raw.bot) is shown as the bot\'s, and it makes the chat "served"', () => {
    const groups = [g('a', 'Budi')];
    const msgs = [m('1', 'a', '2026-11-13T04:00:00Z', false, 'Halo'), m('2', 'a', '2026-11-13T04:00:05Z', true, 'Hi kak, Fefe disini', { raw: { bot: true } })];
    const t = threadOf(msgs, []);
    expect(t.map((x) => x.sender)).toEqual(['lead', 'bot']);
    expect(t[1].senderName).toBeNull();
    const c = conversationsOf(groups, msgs, [])[0];
    expect(c).toMatchObject({ unserved: false, lastFromMe: true, waitingSince: null });
  });
  it('a message with a named sender is still a person\'s, even if it matches a bot text', () => {
    const t = threadOf([m('2', 'a', '2026-11-13T04:00:05Z', true, 'Hi kak', { raw: { sentBy: { name: 'Rani' } } })], ['Hi kak']);
    expect(t[0]).toMatchObject({ sender: 'team', senderName: 'Rani' });
  });
});

describe('labels and follow-ups in the inbox', () => {
  it('the follow-up tab shows open chats with a reminder that is due today or overdue; search finds label names', () => {
    const list = conversationsOf([g('a', 'A'), g('b', 'B'), g('c', 'C')], [m('1', 'a', '2026-11-13T04:00:00Z', false), m('2', 'b', '2026-11-13T04:00:00Z', false), m('3', 'c', '2026-11-13T04:00:00Z', false)], []);
    list.find((c) => c.id === 'a')!.nextReminder = { id: 'r1', dueAt: '2026-11-13T02:00:00Z', note: null, state: 'overdue' };
    list.find((c) => c.id === 'b')!.nextReminder = { id: 'r2', dueAt: '2026-11-20T02:00:00Z', note: null, state: 'later' };
    list.find((c) => c.id === 'c')!.labels = [{ id: 'l1', name: 'Hot lead', color: 'red' }];
    expect(filterConversations(list, 'followup', '').map((c) => c.id)).toEqual(['a']);
    expect(countsOf(list).followup).toBe(1);
    expect(filterConversations(list, 'all', 'hot').map((c) => c.id)).toEqual(['c']);
  });
});
