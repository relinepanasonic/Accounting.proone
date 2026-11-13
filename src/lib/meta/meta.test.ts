import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { chatChannel, chatLabel, clientPhoneOf, metaChatId, metaUserId, phoneTail, replyWindowOpen } from '@/lib/chat/channel';
import { isOwnEcho, parseMetaWebhook, toParsed, validSignature } from './parse';
import { metaErrorText, sendMeta } from './send';

describe('which app a chat lives in', () => {
  it('a phone number is WhatsApp; ig: and fb: are Instagram and Messenger', () => {
    expect(['6281234567890', 'ig:178414', 'fb:2456'].map(chatChannel)).toEqual(['whatsapp', 'instagram', 'messenger']);
    expect(metaChatId('instagram', '178414')).toBe('ig:178414');
    expect(metaUserId('fb:2456')).toBe('2456');
  });
  it('an Instagram or Messenger id never matches an ERP client by phone, and makes no phone on a new client', () => {
    expect(phoneTail('ig:17841400123456789')).toBe('');
    expect(phoneTail('+62 812-3456-7890')).toBe('234567890');
    expect(clientPhoneOf('fb:2456')).toBeNull();
    expect(clientPhoneOf('6281234567890')).toBe('+6281234567890');
  });
  it('a chat without a name is called by its app', () => {
    expect([chatLabel('ig:1'), chatLabel('fb:1'), chatLabel('628111')]).toEqual(['Instagram user', 'Messenger user', '+628111']);
  });
  it('Instagram and Messenger allow a reply only within 24 hours of the customer\'s last message; WhatsApp always', () => {
    const now = new Date('2026-11-13T12:00:00Z');
    expect(replyWindowOpen('instagram', '2026-11-12T13:00:00Z', now)).toBe(true);
    expect(replyWindowOpen('messenger', '2026-11-12T11:59:00Z', now)).toBe(false);
    expect(replyWindowOpen('instagram', null, now)).toBe(false);
    expect(replyWindowOpen('whatsapp', null, now)).toBe(true);
  });
});

const ig = (messaging: any[]) => ({ object: 'instagram', entry: [{ id: 'IGACC', time: 1, messaging }] });
const fb = (messaging: any[]) => ({ object: 'page', entry: [{ id: 'PAGE', time: 1, messaging }] });

describe('parseMetaWebhook', () => {
  it('reads an Instagram DM and a Messenger message', () => {
    const a = parseMetaWebhook(ig([{ sender: { id: 'U1' }, recipient: { id: 'IGACC' }, timestamp: 1763035200000, message: { mid: 'm1', text: 'Halo kak, mau tanya paket' } }]));
    expect(a).toEqual([expect.objectContaining({ channel: 'instagram', accountId: 'IGACC', userId: 'U1', mid: 'm1', text: 'Halo kak, mau tanya paket', isEcho: false })]);
    const b = parseMetaWebhook(fb([{ sender: { id: 'P9' }, recipient: { id: 'PAGE' }, timestamp: 1, message: { mid: 'm2', text: 'Info harga' } }]));
    expect(b[0]).toMatchObject({ channel: 'messenger', accountId: 'PAGE', userId: 'P9' });
  });
  it('a picture comes with its type and link; a button press reads as its title', () => {
    const [p] = parseMetaWebhook(ig([{ sender: { id: 'U1' }, recipient: { id: 'IGACC' }, message: { mid: 'm3', attachments: [{ type: 'image', payload: { url: 'https://cdn/x.jpg' } }] } }]));
    expect(p).toMatchObject({ text: null, mediaType: 'image', mediaUrl: 'https://cdn/x.jpg' });
    const [q] = parseMetaWebhook(fb([{ sender: { id: 'P9' }, recipient: { id: 'PAGE' }, postback: { mid: 'm4', title: 'Lihat paket' } }]));
    expect(q).toMatchObject({ text: 'Lihat paket' });
  });
  it('an echo (our account sent it) is for the customer on the other side; read receipts, reactions and deleted messages are skipped', () => {
    const [e] = parseMetaWebhook(fb([{ sender: { id: 'PAGE' }, recipient: { id: 'P9' }, message: { mid: 'm5', text: 'Siap kak', is_echo: true, app_id: 111 } }]));
    expect(e).toMatchObject({ userId: 'P9', isEcho: true, appId: '111' });
    expect(parseMetaWebhook(fb([{ sender: { id: 'P9' }, recipient: { id: 'PAGE' }, read: { watermark: 1 } }, { sender: { id: 'P9' }, recipient: { id: 'PAGE' }, message: { mid: 'm6', is_deleted: true } }]))).toEqual([]);
    expect(parseMetaWebhook({ object: 'whatsapp_business_account', entry: [] })).toEqual([]);
  });
  it('our own echoes are skipped (already saved when sent); a reply typed in Meta\'s inbox is kept', () => {
    const [mine] = parseMetaWebhook(fb([{ sender: { id: 'PAGE' }, recipient: { id: 'P9' }, message: { mid: 'a', text: 'x', is_echo: true, app_id: 111 } }]));
    const [inbox] = parseMetaWebhook(fb([{ sender: { id: 'PAGE' }, recipient: { id: 'P9' }, message: { mid: 'b', text: 'x', is_echo: true, app_id: 999 } }]));
    expect(isOwnEcho(mine, '111')).toBe(true);
    expect(isOwnEcho(inbox, '111')).toBe(false);
    expect(isOwnEcho(inbox, undefined)).toBe(true);           // without the app id set, nothing can be saved twice
  });
  it('becomes the same shape as a WhatsApp message', () => {
    const [e] = parseMetaWebhook(ig([{ sender: { id: 'U1' }, recipient: { id: 'IGACC' }, timestamp: 5, message: { mid: 'm1', text: 'Halo' } }]));
    expect(toParsed(e, 'ig:IGACC', 'Sari')).toMatchObject({ device: 'ig:IGACC', chatId: 'ig:U1', isGroup: false, groupName: 'Sari', body: 'Halo', isFromMe: false, dedupeKey: 'meta:m1' });
  });
});

describe('webhook signature', () => {
  it('only a call signed with our app secret is accepted', () => {
    const body = '{"object":"page"}';
    const sig = 'sha256=' + createHmac('sha256', 'shh').update(body).digest('hex');
    expect(validSignature(body, sig, 'shh')).toBe(true);
    expect(validSignature(body + ' ', sig, 'shh')).toBe(false);
    expect(validSignature(body, sig, undefined)).toBe(false);
    expect(validSignature(body, null, 'shh')).toBe(false);
  });
});

describe('sendMeta', () => {
  it('sends as a reply to the customer, split to fit Instagram (1000 characters)', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ recipient_id: 'U1', message_id: 'mid.1' }), { status: 200 }));
    const r = await sendMeta('instagram', 'U1', `${'a'.repeat(900)}\n\n${'b'.repeat(900)}`, 'TOKEN', f as any);
    expect(r).toMatchObject({ ok: true, parts: 2 });
    const [url, init] = (f.mock.calls as any)[0];
    expect(url).toMatch(/\/me\/messages$/);
    expect(JSON.parse(init.body)).toMatchObject({ recipient: { id: 'U1' }, messaging_type: 'RESPONSE', message: { text: 'a'.repeat(900) } });
    expect(init.headers.Authorization).toBe('Bearer TOKEN');
  });
  it('says Meta\'s refusals plainly', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { code: 10, error_subcode: 2018278, message: '...' } }), { status: 400 }));
    expect(await sendMeta('messenger', 'P9', 'hi', 'T', f as any)).toMatchObject({ ok: false, detail: expect.stringContaining('24-hour window') });
    expect(metaErrorText({ code: 190 })).toContain('expired');
  });
});
