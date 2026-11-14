import { describe, it, expect } from 'vitest';
import { deckLine, validDeckUrl } from './deck';
import { buildBotPrompt, parseBotAnswer } from './prompt';

describe('the sales deck link', () => {
  it('only a full https link counts', () => {
    expect(validDeckUrl('https://drive.google.com/drive/folders/abc?usp=drive_link')).toBe('https://drive.google.com/drive/folders/abc?usp=drive_link');
    expect(validDeckUrl('  https://docs.google.com/presentation/d/x  ')).toBe('https://docs.google.com/presentation/d/x');
    expect(validDeckUrl('http://drive.google.com/x')).toBeNull();
    expect(validDeckUrl('drive.google.com/x')).toBeNull();
    expect(validDeckUrl('')).toBeNull();
    expect(validDeckUrl(null)).toBeNull();
  });
  it('goes under the reply', () => {
    expect(deckLine('Ini deck kami ya kak.', 'https://drive.google.com/x')).toBe('Ini deck kami ya kak.\n\nDeck Prof Toko Online: https://drive.google.com/x');
  });
  it('the bot is told about the deck only when a link is set, and its answer says when to send it', () => {
    const base = { persona: 'Fefe', company: 'Prof Toko Online', knowledge: 'Paket Juragan', history: [{ from: 'lead' as const, text: 'kak minta deck nya' }], inHours: true, replyNo: 2 };
    expect(buildBotPrompt({ ...base, deck: true }).system).toContain('SALES DECK');
    expect(buildBotPrompt({ ...base, deck: false }).system).not.toContain('SALES DECK');
    expect(parseBotAnswer('{"reply": "Ini deck kami ya kak", "handoff": false, "send_deck": true}')?.sendDeck).toBe(true);
    expect(parseBotAnswer('{"reply": "Halo kak", "handoff": false}')?.sendDeck).toBe(false);
  });
});
