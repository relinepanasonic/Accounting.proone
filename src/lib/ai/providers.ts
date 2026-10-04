// Model access for the AI Office. Server-side only (uses secret keys): never import from client components.
// Boss (planner + QC) = Claude. Workers = a cheap model per floor (Groq / Gemini), with Claude Haiku as the
// stand-in when that provider's key is not set, so the office works with only ANTHROPIC_API_KEY.
import Anthropic from '@anthropic-ai/sdk';

export type Provider = 'anthropic' | 'groq' | 'gemini' | 'openrouter' | 'zai' | 'deepseek';
type CheapProvider = Exclude<Provider, 'anthropic'>;

export const BOSS_MODEL = 'claude-sonnet-5-5';
export const BOSS_DEEP_MODEL = 'claude-opus-5-5';
export const WORKER_FALLBACK_MODEL = 'claude-haiku-4-5';

const OPENAI_COMPATIBLE: Record<CheapProvider, { baseUrl: string; keyEnv: string }> = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', keyEnv: 'GROQ_API_KEY' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyEnv: 'GEMINI_API_KEY' },
  // One key, many models (incl. free ones ending in ":free", e.g. qwen/qwen3.8-27b:free).
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', keyEnv: 'OPENROUTER_API_KEY' },
  // Zhipu GLM (z.ai). Set ZAI_BASE_URL to the coding-plan endpoint if you use that plan.
  zai: { baseUrl: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4', keyEnv: 'ZAI_API_KEY' },
  // DeepSeek direct API (platform.deepseek.com). Servers are in China: keep client/financial data off it.
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', keyEnv: 'DEEPSEEK_API_KEY' },
};

export interface Pic {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  data: string;
}

/** A user message for Claude: the pictures first, then the text. */
function claudeContent(prompt: string, pics?: Pic[]): string | Anthropic.ContentBlockParam[] {
  if (!pics || pics.length === 0) return prompt;
  return [
    ...pics.map((p): Anthropic.ContentBlockParam => ({ type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.data } })),
    { type: 'text', text: prompt },
  ];
}

export function providerStatus() {
  return {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    zai: Boolean(process.env.ZAI_API_KEY),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
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
  images?: Pic[];
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
    messages: [{ role: 'user', content: claudeContent(opts.prompt, opts.images) }],
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

const CHEAP_DEFAULT_MODEL: Record<CheapProvider, string> = {
  groq: 'openai/gpt-oss-20b',
  gemini: 'gemini-3.8-flash',
  openrouter: 'qwen/qwen3.8-27b:free',
  zai: 'glm-4.5-flash',
  deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
};

async function callOpenAiCompatible(provider: CheapProvider, model: string, system: string, prompt: string, pics?: Pic[]): Promise<{ text: string } & ModelUsage> {
  const cfg = OPENAI_COMPATIBLE[provider];
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env[cfg.keyEnv]}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          // Only Gemini among the cheap providers takes pictures; the others rely on the written description in the brief.
          content: provider === 'gemini' && pics && pics.length > 0
            ? [...pics.map((p) => ({ type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.data}` } })), { type: 'text', text: prompt }]
            : prompt,
        },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const detail = (await res.text()).replace(/\s+/g, ' ').slice(0, 160);
    throw new Error(`${provider} answered ${res.status}: ${detail}`);
  }
  const json = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new Error(`${provider} returned an empty answer.`);
  return {
    text,
    model: `${provider}/${model}`,
    tokensIn: Number(json?.usage?.prompt_tokens || 0),
    tokensOut: Number(json?.usage?.completion_tokens || 0),
  };
}

/**
 * Worker call: plain text answer. Tries the agent's own provider first; if that provider has no key or is
 * down (busy, rate limited, timed out), tries the other cheap providers that have a key, then Claude Haiku.
 * `note` says which stand-in answered, so the activity log shows it.
 */
export async function askWorker(opts: {
  provider: Provider;
  model: string;
  system: string;
  prompt: string;
  images?: Pic[];
}): Promise<{ text: string } & ModelUsage> {
  const problems: string[] = [];

  if (opts.provider !== 'anthropic') {
    const others = (Object.keys(CHEAP_DEFAULT_MODEL) as CheapProvider[]).filter((p) => p !== opts.provider);
    const chain: { provider: CheapProvider; model: string }[] = [
      { provider: opts.provider, model: opts.model },
      ...others.map((p) => ({ provider: p, model: CHEAP_DEFAULT_MODEL[p] })),
    ];
    for (const step of chain) {
      if (!process.env[OPENAI_COMPATIBLE[step.provider].keyEnv]) {
        problems.push(`no ${step.provider} key`);
        continue;
      }
      try {
        const out = await callOpenAiCompatible(step.provider, step.model, opts.system, opts.prompt, opts.images);
        return problems.length ? { ...out, note: `Used ${step.provider} instead (${problems.join('; ')}).` } : out;
      } catch (err) {
        problems.push(err instanceof Error ? (err.name === 'TimeoutError' ? `${step.provider} timed out` : err.message.slice(0, 60)) : `${step.provider} failed`);
      }
    }
  }

  const model = opts.provider === 'anthropic' ? opts.model : WORKER_FALLBACK_MODEL;
  const res = await anthropic().messages.create({
    model,
    max_tokens: 4000,
    system: opts.system,
    messages: [{ role: 'user', content: claudeContent(opts.prompt, opts.images) }],
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
    note: problems.length ? `Used Claude Haiku instead (${problems.join('; ')}).` : undefined,
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
  images?: Pic[];
}): Promise<{ text: string } & ModelUsage> {
  const isHaiku = opts.model.includes('haiku');
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: claudeContent(opts.prompt, opts.images) }];
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

export type ImageMode = 'text' | 'design';

const READ_TEXT =
  'You read an image that the owner attached to a brief for an AI team. Write down everything useful in it as plain text: copy ALL visible text exactly as written (keep numbers, keywords, names and their order), ' +
  'render tables as one line per row with " | " between columns, and add one short line describing what the image is. Do not summarize, interpret or add anything that is not visible. No Markdown symbols.';
const READ_DESIGN =
  'You describe a design reference picture that the owner attached to a brief, for a team member who cannot see it. Describe in plain text, in this order: ' +
  '1) what it is (page, app screen, poster, logo, ad...) and its overall style and mood; 2) layout: the sections from top to bottom, columns, alignment, spacing; ' +
  '3) color palette with approximate hex codes and where each color is used; 4) typography: font style (serif, sans, rounded...), sizes and weights of headings and body; ' +
  '5) components: buttons, cards, icons, images, borders, shadows, corner radius; 6) the visible text, copied exactly. Be specific and concrete so someone could rebuild it. No Markdown symbols.';

/**
 * Reads the pictures attached to a brief and returns what is in them as plain text, so every agent
 * (including cheap models that cannot see images) can use it. 'text' copies the words; 'design' describes the look.
 * Claude Haiku does the reading.
 */
export async function readImages(images: (Pic & { mode: ImageMode })[]): Promise<{ texts: string[] } & ModelUsage> {
  const texts: string[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  let model: string = WORKER_FALLBACK_MODEL;
  for (const img of images) {
    const res = await anthropic().messages.create({
      model: WORKER_FALLBACK_MODEL,
      max_tokens: img.mode === 'design' ? 2000 : 2500,
      system: img.mode === 'design' ? READ_DESIGN : READ_TEXT,
      messages: [{ role: 'user', content: claudeContent(img.mode === 'design' ? 'Describe this design.' : 'Transcribe this image.', [img]) }],
    });
    tokensIn += res.usage.input_tokens;
    tokensOut += res.usage.output_tokens;
    model = res.model;
    let text = '';
    for (const block of res.content) if (block.type === 'text') text += block.text;
    texts.push(text.trim() || '(nothing readable)');
  }
  return { texts, model, tokensIn, tokensOut };
}
