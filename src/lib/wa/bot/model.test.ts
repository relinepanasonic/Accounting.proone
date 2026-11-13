import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const create = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create }; } }));
import { askBotModel } from './model';

const claude = (text: string) => ({ content: [{ type: 'text', text }], model: 'claude-haiku-5-5', usage: { input_tokens: 10, output_tokens: 5 } });
const geminiOk = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));

describe('askBotModel (Claude Haiku first, Gemini as the stand-in)', () => {
  const saved = { g: process.env.GEMINI_API_KEY, a: process.env.ANTHROPIC_API_KEY };
  beforeEach(() => { process.env.GEMINI_API_KEY = 'g-test'; process.env.ANTHROPIC_API_KEY = 'a-test'; create.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); process.env.GEMINI_API_KEY = saved.g; process.env.ANTHROPIC_API_KEY = saved.a; });

  it('answers with Haiku and never calls Gemini when Haiku works', async () => {
    create.mockResolvedValueOnce(claude('{"reply":"Hi kak"}'));
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const r = await askBotModel('sys', 'prompt');
    expect(r).toMatchObject({ text: '{"reply":"Hi kak"}', model: 'claude-haiku-5-5', tokensIn: 10, tokensOut: 5 });
    expect(create.mock.calls[0][0].model).toBe('claude-haiku-5-5');
    expect(f).not.toHaveBeenCalled();
  });

  it('tries the older Haiku, then Gemini, and reports each failure', async () => {
    create.mockRejectedValue(new Error('overloaded'));
    vi.stubGlobal('fetch', vi.fn(async () => geminiOk('{"reply":"dari gemini"}')));
    const r = await askBotModel('sys', 'prompt');
    expect(r.model).toBe('gemini/gemini-3.8-flash');
    expect(create.mock.calls.map((c) => c[0].model)).toEqual(['claude-haiku-5-5', 'claude-haiku-4-5']);
    expect(r.tried).toEqual(['claude-haiku-5-5: overloaded', 'claude-haiku-4-5: overloaded']);
  });

  it('when nothing answers, the error lists every try (so the bot log shows why)', async () => {
    create.mockRejectedValue(new Error('rate limit'));
    vi.stubGlobal('fetch', vi.fn(async () => new Response('quota', { status: 429 })));
    await expect(askBotModel('sys', 'prompt')).rejects.toThrow(/claude-haiku-5-5: rate limit.*claude-haiku-4-5: rate limit.*gemini-3.8-flash: HTTP 429/);
  });

  it('without an Anthropic key it goes straight to Gemini', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.stubGlobal('fetch', vi.fn(async () => geminiOk('{}')));
    const r = await askBotModel('sys', 'prompt');
    expect(r.tried).toEqual(['no ANTHROPIC_API_KEY']);
    expect(create).not.toHaveBeenCalled();
  });
});
