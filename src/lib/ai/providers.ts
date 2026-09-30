// Model access for the AI Office. Server-side only (uses secret keys): never import from client components.
// Boss (planner + QC) = Claude. Workers = a cheap model per floor (Groq / Gemini), with Claude Haiku as the
// stand-in when that provider's key is not set, so the office works with only ANTHROPIC_API_KEY.
import Anthropic from '@anthropic-ai/sdk';

export type Provider = 'anthropic' | 'groq' | 'gemini';

export const BOSS_MODEL = 'claude-sonnet-5-5';
export const BOSS_DEEP_MODEL = 'claude-opus-5-5';
export const WORKER_FALLBACK_MODEL = 'claude-haiku-4-5';

const OPENAI_COMPATIBLE: Record<'groq' | 'gemini', { baseUrl: string; keyEnv: string }> = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', keyEnv: 'GROQ_API_KEY' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyEnv: 'GEMINI_API_KEY' },
};

export function providerStatus() {
  return {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
  };
}

export interface ModelUsage {
  model: string;
  tokensIn: number;
  tokensOut: number;
  note?: string;
}

let anthropicClient: Anthropic | null = null;
const anthropic = () => (anthropicClient ??= new Anthropic());

/** A short, user-readable reason for a failed model call. */
export function describeModelError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Claude API key is missing or invalid.';
  if (err instanceof Anthropic.RateLimitError) return 'Claude rate limit reached. Try again shortly.';
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? ''}: ${err.message}`.trim();
  if (err instanceof Error) return err.name === 'TimeoutError' ? 'The model took too long to answer.' : err.message;
  return 'Unknown model error.';
}

/** Boss call: Claude returns JSON matching `schema` (structured output). `deep` switches Sonnet -> Opus. */
export async function askBoss<T>(opts: {
  deep: boolean;
  effort?: 'low' | 'medium';
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
}): Promise<{ data: T } & ModelUsage> {
  const res = await anthropic().beta.messages.create({
    model: opts.deep ? BOSS_DEEP_MODEL : BOSS_MODEL,
    max_tokens: 16000,
    // If a safety classifier declines the request, Anthropic retries it on its recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: opts.deep ? 'high' : opts.effort ?? 'medium',
      format: { type: 'json_schema', schema: opts.schema },
    },
    system: opts.system,
    messages: [{ role: 'user', content: opts.prompt }],
  });

  if (res.stop_reason === 'refusal') throw new Error('The boss model declined this request.');
  if (res.stop_reason === 'max_tokens') throw new Error('The boss answer was cut off (too long).');

  let text = '';
  for (const block of res.content) {
    if (block.type === 'text') text += block.text;
  }

  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error('The boss returned an answer that could not be read.');
  }

  return { data, model: res.model, tokensIn: res.usage.input_tokens, tokensOut: res.usage.output_tokens };
}

/** Worker call: plain text answer from the agent's own provider, or Claude Haiku when its key is not set. */
export async function askWorker(opts: {
  provider: Provider;
  model: string;
  system: string;
  prompt: string;
}): Promise<{ text: string } & ModelUsage> {
  if (opts.provider !== 'anthropic') {
    const cfg = OPENAI_COMPATIBLE[opts.provider];
    const apiKey = process.env[cfg.keyEnv];
    if (apiKey) {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: opts.model,
          messages: [
            { role: 'system', content: opts.system },
            { role: 'user', content: opts.prompt },
          ],
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 200);
        throw new Error(`${opts.provider} answered ${res.status}: ${detail}`);
      }
      const json = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? '';
      if (!text.trim()) throw new Error(`${opts.provider} returned an empty answer.`);
      return {
        text,
        model: `${opts.provider}/${opts.model}`,
        tokensIn: Number(json?.usage?.prompt_tokens || 0),
        tokensOut: Number(json?.usage?.completion_tokens || 0),
      };
    }
  }

  const model = opts.provider === 'anthropic' ? opts.model : WORKER_FALLBACK_MODEL;
  const res = await anthropic().messages.create({
    model,
    max_tokens: 4000,
    system: opts.system,
    messages: [{ role: 'user', content: opts.prompt }],
  });
  let text = '';
  for (const block of res.content) {
    if (block.type === 'text') text += block.text;
  }
  if (!text.trim()) throw new Error('The worker returned an empty answer.');

  return {
    text,
    model: res.model,
    tokensIn: res.usage.input_tokens,
    tokensOut: res.usage.output_tokens,
    note: opts.provider === 'anthropic' ? undefined : `No ${opts.provider} key set, used Claude Haiku instead.`,
  };
}

/**
 * Researcher call: Claude with live web search (a server-side tool, Anthropic runs the searches).
 * Cost controls: few searches, automatic prompt caching so a resumed turn re-reads earlier pages at the
 * cache price, low reasoning effort, and a modest output cap. Haiku uses the basic search tool (the
 * dynamic-filtering version needs a larger model).
 */
export async function askResearcher(opts: {
  model: string;
  system: string;
  prompt: string;
  maxSearches?: number;
}): Promise<{ text: string } & ModelUsage> {
  const isHaiku = opts.model.includes('haiku');
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: opts.prompt }];
  let tokensIn = 0;
  let tokensOut = 0;
  let model = opts.model;

  for (let turn = 0; turn < 3; turn++) {
    const res = await anthropic().messages.create({
      model: opts.model,
      max_tokens: 3000,
      cache_control: { type: 'ephemeral' },
      ...(isHaiku ? {} : { output_config: { effort: 'low' as const } }),
      system: opts.system,
      tools: [
        isHaiku
          ? { type: 'web_search_20250305' as const, name: 'web_search' as const, max_uses: opts.maxSearches ?? 4 }
          : { type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: opts.maxSearches ?? 4 },
      ],
      messages,
    });
    // Cached reads are billed at a fraction, so count them separately from fresh input.
    tokensIn += res.usage.input_tokens + (res.usage.cache_creation_input_tokens ?? 0) + Math.round((res.usage.cache_read_input_tokens ?? 0) * 0.1);
    tokensOut += res.usage.output_tokens;
    model = res.model;

    if (res.stop_reason === 'refusal') throw new Error('The researcher model declined this request.');
    if (res.stop_reason === 'pause_turn') {
      // Resume: hand the paused assistant turn back unchanged.
      messages.push({ role: 'assistant', content: res.content });
      continue;
    }

    let text = '';
    for (const block of res.content) {
      if (block.type === 'text') text += block.text;
    }
    if (!text.trim()) throw new Error('The researcher returned an empty answer.');
    return { text, model, tokensIn, tokensOut };
  }
  throw new Error('The research took too many steps and was stopped.');
}
