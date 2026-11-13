import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { askBotModel } from './model';

const ok = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));

describe('askBotModel', () => {
  const saved = { g: process.env.GEMINI_API_KEY, a: process.env.ANTHROPIC_API_KEY };
  beforeEach(() => { process.env.GEMINI_API_KEY = 'g-test'; delete process.env.ANTHROPIC_API_KEY; });
  afterEach(() => { vi.unstubAllGlobals(); process.env.GEMINI_API_KEY = saved.g; process.env.ANTHROPIC_API_KEY = saved.a; });

  it('answers with the first Gemini model that works, and says which one', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: any, init: any) => { const m = JSON.parse(init.body).model; calls.push(m); return m === 'gemini-3.8-flash' ? new Response('not found', { status: 404 }) : ok('{"reply":"Hi kak"}'); }));
    const r = await askBotModel('sys', 'prompt');
    expect(r.text).toBe('{"reply":"Hi kak"}');
    expect(r.model).toBe('gemini/gemini-2.5-flash');
    expect(calls).toEqual(['gemini-3.8-flash', 'gemini-2.5-flash']);
    expect(r.tried[0]).toMatch(/gemini-3.8-flash: HTTP 404/);
  });

  it('when nothing answers, the error lists every try (so the bot log shows why)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('quota', { status: 429 })));
    await expect(askBotModel('sys', 'prompt')).rejects.toThrow(/gemini-3.8-flash: HTTP 429.*gemini-2.5-flash: HTTP 429.*no ANTHROPIC_API_KEY/);
  });

  it('asks Gemini for JSON with a short answer', async () => {
    let body: any = null;
    vi.stubGlobal('fetch', vi.fn(async (_u: any, init: any) => { body = JSON.parse(init.body); return ok('{}'); }));
    await askBotModel('sys', 'prompt');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.max_tokens).toBe(600);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
  });
});
