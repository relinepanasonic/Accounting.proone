import { describe, it, expect } from 'vitest';
import { parseFonnteWebhook, cleanPhone, mediaTypeOf } from './parse-webhook';

const NOW = new Date('2026-11-12T03:00:00Z');

describe('cleanPhone', () => {
  it('keeps digits only and drops WhatsApp suffixes', () => {
    expect(cleanPhone('+62 897-2341-717')).toBe('628972341717');
    expect(cleanPhone('628972341717@s.whatsapp.net')).toBe('628972341717');
    expect(cleanPhone('628972341717:12@s.whatsapp.net')).toBe('628972341717');
    expect(cleanPhone('')).toBeNull();
  });
});

describe('parseFonnteWebhook', () => {
  it('a group message: the group is the chat and the member is the author', () => {
    const m = parseFonnteWebhook({ device: '628972341717', sender: '120363012345678901@g.us', member: '6281234567890', name: 'Budi', message: 'Order masuk 3 pcs' }, NOW)!;
    expect(m.isGroup).toBe(true);
    expect(m.chatId).toBe('120363012345678901');
    expect(m.senderPhone).toBe('6281234567890');
    expect(m.senderName).toBe('Budi');
    expect(m.body).toBe('Order masuk 3 pcs');
    expect(m.isFromMe).toBe(false);
  });

  it('a group is recognised by the member field even without a @g.us id', () => {
    const m = parseFonnteWebhook({ device: '628972341717', sender: '12036301234', member: '6281234567890', message: 'hi' }, NOW)!;
    expect(m.isGroup).toBe(true);
    expect(m.senderPhone).toBe('6281234567890');
  });

  it('a private chat: the sender is both the chat and the author', () => {
    const m = parseFonnteWebhook({ device: '628972341717', sender: '6281234567890', name: 'Sari', message: 'halo' }, NOW)!;
    expect(m.isGroup).toBe(false);
    expect(m.chatId).toBe('6281234567890');
    expect(m.senderPhone).toBe('6281234567890');
  });

  it('a message sent by our own device is marked from me', () => {
    const m = parseFonnteWebhook({ device: '628972341717', sender: '120363012345678901@g.us', member: '628972341717', message: 'siap' }, NOW)!;
    expect(m.isFromMe).toBe(true);
  });

  it('media: type comes from the extension, and a caption-less image is still kept', () => {
    const m = parseFonnteWebhook({ device: '628972341717', sender: '120363012345678901@g.us', member: '6281', url: 'https://x.test/a.jpg', extension: 'jpg', filename: 'a.jpg' }, NOW)!;
    expect(m.mediaType).toBe('image');
    expect(m.mediaFilename).toBe('a.jpg');
    expect(m.body).toBeNull();
  });

  it('location and poll get a readable body', () => {
    expect(parseFonnteWebhook({ device: '6281', sender: '6282', location: '-7.2,112.7' }, NOW)!.body).toBe('Location: -7.2,112.7');
    expect(parseFonnteWebhook({ device: '6281', sender: '6282', pollname: 'Rapat?', choices: ['Ya', 'Tidak'] }, NOW)!.body).toBe('Poll: Rapat? (Ya, Tidak)');
  });

  it('empty or incomplete payloads are dropped', () => {
    expect(parseFonnteWebhook({}, NOW)).toBeNull();
    expect(parseFonnteWebhook({ device: '6281', sender: '6282' }, NOW)).toBeNull();
    expect(parseFonnteWebhook({ sender: '6282', message: 'x' }, NOW)).toBeNull();
  });

  it('the same message in the same minute gets the same dedupe key; a different one does not', () => {
    const p = { device: '6281', sender: '6282', message: 'halo' };
    expect(parseFonnteWebhook(p, NOW)!.dedupeKey).toBe(parseFonnteWebhook(p, new Date(NOW.getTime() + 20000))!.dedupeKey);
    expect(parseFonnteWebhook(p, NOW)!.dedupeKey).not.toBe(parseFonnteWebhook({ ...p, message: 'halo2' }, NOW)!.dedupeKey);
  });

  it('an inbox id wins as the dedupe key', () => {
    expect(parseFonnteWebhook({ device: '6281', sender: '6282', message: 'a', inboxid: '991' }, NOW)!.dedupeKey).toBe('fonnte:991');
  });
});

describe('mediaTypeOf', () => {
  it('maps extensions, falls back to document, and null without media', () => {
    expect(mediaTypeOf('mp4', 'u')).toBe('video');
    expect(mediaTypeOf(null, 'https://x/y.ogg?z=1')).toBe('audio');
    expect(mediaTypeOf('pdf', 'u')).toBe('document');
    expect(mediaTypeOf(null, null)).toBeNull();
  });
});
