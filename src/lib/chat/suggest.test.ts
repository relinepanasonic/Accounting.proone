import { describe, it, expect } from 'vitest';
import { buildSuggestPrompt, cleanSuggestion } from './suggest';

describe('buildSuggestPrompt', () => {
  const p = buildSuggestPrompt({ persona: 'Fefe', company: 'Prof Toko Online', knowledge: 'Paket Hemat: ISI', agentName: 'Rani', history: [{ from: 'lead', text: 'berapa paketnya?' }, { from: 'team', text: 'sebentar ya kak' }] });
  it('writes for the salesperson, in the warm "kak" style, from the knowledge only, as plain text', () => {
    expect(p.system).toContain('Rani');
    expect(p.system).toContain('"kak"');
    expect(p.system).toContain('Paket Hemat: ISI');
    expect(p.system).toMatch(/hanya teks balasan/i);
    expect(p.system).toMatch(/jangan mengarang/i);
  });
  it('gives the conversation with the lead as "Kakak" and the team as "Tim"', () => {
    expect(p.prompt).toContain('Kakak: berapa paketnya?');
    expect(p.prompt).toContain('Tim: sebentar ya kak');
  });
});

describe('cleanSuggestion', () => {
  it('removes Markdown and unknown links, keeps a longer text than a bot reply', () => {
    expect(cleanSuggestion('**Halo kak** cek https://x.test ya')).toBe('Halo kak cek ya');
    expect(cleanSuggestion('kalimat yang agak panjang. '.repeat(25)).length).toBeGreaterThan(300);
  });
});
