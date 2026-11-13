import { describe, it, expect } from 'vitest';
import { computeStats, median, reasonGroup, repliesOf, responderOf, type StatsInput, type StatsMessage } from './stats';

const NOW = new Date('2026-11-13T05:00:00Z');
const t = (minAgo: number) => new Date(NOW.getTime() - minAgo * 60000).toISOString();
const lead = (g: string, minAgo: number): StatsMessage => ({ group_id: g, is_from_me: false, sent_at: t(minAgo) });
const bot = (g: string, minAgo: number): StatsMessage => ({ group_id: g, is_from_me: true, sent_at: t(minAgo), source: 'bot', raw: { bot: true } });
const person = (g: string, minAgo: number, name: string): StatsMessage => ({ group_id: g, is_from_me: true, sent_at: t(minAgo), source: 'dashboard', raw: { sentBy: { name } } });

describe('who replied', () => {
  it('the bot and flows are "Bot"; a dashboard reply is the person; anything else is "Team"', () => {
    expect(responderOf(bot('a', 1))).toBe('Bot');
    expect(responderOf({ group_id: 'a', is_from_me: true, sent_at: t(1), source: 'flow', raw: { bot: true } })).toBe('Bot');
    expect(responderOf(person('a', 1, 'Rani'))).toBe('Rani');
    expect(responderOf({ group_id: 'a', is_from_me: true, sent_at: t(1) })).toBe('Team');
  });
});

describe('repliesOf', () => {
  it('the clock starts at the FIRST of several lead messages in a row and stops at our next message', () => {
    const r = repliesOf([lead('a', 30), lead('a', 25), lead('a', 20), bot('a', 28 - 8), person('a', 5, 'Rani')]);
    // lead 30 -> bot at 20 = 10 min. Then nobody waiting until... Rani at 5 has no waiting lead: not a reply
    expect(r).toEqual([{ group_id: 'a', by: 'Bot', minutes: 10, at: t(20) }]);
  });
  it('each lead turn gets its own reply; a message we start with nobody waiting is not a reply', () => {
    const r = repliesOf([person('a', 100, 'Rani'), lead('a', 60), person('a', 50, 'Rani'), lead('a', 40), lead('a', 39), bot('a', 38)]);
    expect(r.map((x) => [x.by, x.minutes])).toEqual([['Rani', 10], ['Bot', 2]]);
  });
  it('keeps chats apart and does not care about the order rows came in', () => {
    const r = repliesOf([bot('b', 10), lead('a', 30), lead('b', 15), person('a', 0, 'Lucy')]);
    expect(r.map((x) => [x.group_id, x.by, x.minutes]).sort()).toEqual([['a', 'Lucy', 30], ['b', 'Bot', 5]]);
  });
});

describe('median', () => {
  it('middle value, average of the two middle ones, null when empty', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('reasonGroup', () => {
  it('groups the bot\'s hand-over reasons into a few readable ones', () => {
    expect(reasonGroup('A salesperson replied.')).toBe('A salesperson took over');
    expect(reasonGroup('Rani replied from the dashboard.')).toBe('A salesperson took over');
    expect(reasonGroup('Price negotiation.')).toBe('Price negotiation');
    expect(reasonGroup('The bot already sent 4 messages.')).toBe('Bot message limit');
    expect(reasonGroup('The bot could not answer.')).toBe('Bot could not answer');
    expect(reasonGroup(null)).toBe('Other');
  });
});

describe('computeStats', () => {
  const input: StatsInput = {
    messages: [
      lead('a', 60), bot('a', 59), lead('a', 30), person('a', 20, 'Rani Putri'),      // bot 1 min, Rani 10 min
      lead('b', 120), bot('b', 118),                                                   // bot 2 min
      lead('c', 50), person('c', 45, 'Lucy'),                                          // Lucy 5 min
      lead('old', 60 * 24 * 40), bot('old', 60 * 24 * 40 - 1),                        // 40 days ago: outside 30 days
    ],
    chats: [
      { group_id: 'a', first_message_at: t(60), assigned_name: 'Rani', source_channel: 'meta_ads', wa_id: '628111000001' },
      { group_id: 'b', first_message_at: t(120), assigned_name: null, source_channel: 'meta_ads', wa_id: '628111000002' },
      { group_id: 'c', first_message_at: t(50), assigned_name: 'Lucy', source_channel: 'google_ads', wa_id: '628111000003' },
      { group_id: 'old', first_message_at: t(60 * 24 * 40), assigned_name: null, source_channel: null, wa_id: '628111000009' },
    ],
    botChats: [
      { group_id: 'a', status: 'human', replies: 1, reason: 'Rani replied from the dashboard.' },
      { group_id: 'b', status: 'bot', replies: 1, reason: null },
    ],
    clients: [{ id: 'k1', phone: '0811-1000-001' }, { id: 'k3', phone: '+62 811 1000 003' }],
    deals: [
      { client_id: 'k1', salesman_name: 'Rani Putri', stage: 'Deal', value: 4000000, created_at: t(55), stage_changed_at: t(10) },
      { client_id: 'k3', salesman_name: 'Lucy', stage: 'Lead', value: 0, created_at: t(40), stage_changed_at: t(40) },
      { client_id: 'kx', salesman_name: 'Rani Putri', stage: 'Deal', value: 9, created_at: t(10), stage_changed_at: t(10) },   // not a sales-number client
    ],
    reminders: [{ due_at: t(5), done_at: null }, { due_at: t(-60), done_at: null }, { due_at: t(100), done_at: t(90) }],
    unserved: [{ waitingSince: t(12) }, { waitingSince: t(3) }],
  };
  const s = computeStats(input, { days: 30, now: NOW });

  it('overview: new chats, replies and median reply times (bot vs people), share answered within 5 minutes', () => {
    expect(s.overview).toMatchObject({ newChats: 3, replies: 4, medianBot: 1.5, medianPeople: 7.5, medianReply: 3.5 });
    expect(s.overview.within5).toBe(0.75);
  });
  it('leads made and deals won in the period, only for clients that came through the sales number', () => {
    expect(s.overview).toMatchObject({ leads: 2, won: 1, wonValue: 4000000 });
  });
  it('the bot: chats it answered, how many went to a person and why', () => {
    expect(s.bot).toMatchObject({ chatsAnswered: 2, replies: 2, handedOver: 1, stillWithBot: 1 });
    expect(s.bot.reasons).toEqual([{ reason: 'A salesperson took over', count: 1 }]);
  });
  it('per person: one row per first name, with chats, replies, reply time, leads and won', () => {
    const rani = s.people.find((p) => p.name.toLowerCase().startsWith('rani'))!;
    expect(rani).toMatchObject({ chats: 1, replies: 1, medianMinutes: 10, leads: 1, won: 1, wonValue: 4000000 });
    expect(s.people.filter((p) => p.name.toLowerCase().startsWith('rani'))).toHaveLength(1);
    expect(s.people.find((p) => p.name === 'Lucy')).toMatchObject({ chats: 1, replies: 1, medianMinutes: 5, leads: 1, won: 0 });
  });
  it('the funnel per channel: new chats, how many became a lead, how many were won', () => {
    expect(s.funnel).toEqual([
      { channel: 'meta_ads', chats: 2, leads: 1, won: 1, wonValue: 4000000 },
      { channel: 'google_ads', chats: 1, leads: 1, won: 0, wonValue: 0 },
    ]);
  });
  it('right now: chats waiting, the longest wait, overdue follow-ups', () => {
    expect(s.now).toEqual({ waiting: 2, longestWaitMinutes: 12, overdueFollowups: 1 });
  });
  it('one row per day of the period, newest last, with the counts on the right day', () => {
    expect(s.daily).toHaveLength(30);
    expect(s.daily[29]).toMatchObject({ day: '2026-11-13', newChats: 3, replies: 4 });
    expect(s.daily.reduce((n, d) => n + d.leadMessages, 0)).toBe(4);
  });
  it('an empty period gives zeros and empty lists, never errors', () => {
    const e = computeStats({ messages: [], chats: [], botChats: [], deals: [], clients: [], reminders: [], unserved: [] }, { days: 7, now: NOW });
    expect(e.overview).toMatchObject({ newChats: 0, replies: 0, medianReply: null, within5: null, won: 0 });
    expect(e.people).toEqual([]);
    expect(e.now).toEqual({ waiting: 0, longestWaitMinutes: null, overdueFollowups: 0 });
  });
});
