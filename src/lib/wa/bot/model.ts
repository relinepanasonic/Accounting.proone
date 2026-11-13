import Anthropic from '@anthropic-ai/sdk';

/**
 * The sales bot's model call, kept short so it always fits inside the webhook's time on Vercel:
 * Claude Haiku first (reliable, good Indonesian), then Gemini Flash as the stand-in. Each try has its own short timeout, so the whole call takes at most ~40 seconds.
 * DeepSeek is never used here (its servers are in China; leads' chats stay off it). Every failed try is reported, so the bot log shows why.
 */

export interface BotModelResult { text: string; model: string; tokensIn: number; tokensOut: number; tried: string[] }

const GEMINI_MODELS = ['gemini-3.8-flash'];
const HAIKU_MODELS = ['claude-haiku-5-5', 'claude-haiku-4-5'];

async function gemini(model: string, system: string, prompt: string, ms: number) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], response_format: { type: 'json_object' }, max_tokens: 600 }),
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).replace(/\s+/g, ' ').slice(0, 120)}`);
  const j = await res.json();
  const text: string = j?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new Error('empty answer');
  return { text, model: `gemini/${model}`, tokensIn: Number(j?.usage?.prompt_tokens || 0), tokensOut: Number(j?.usage?.completion_tokens || 0) };
}

async function haiku(model: string, system: string, prompt: string, ms: number) {
  const res = await new Anthropic({ timeout: ms, maxRetries: 0 }).messages.create({ model, max_tokens: 600, system, messages: [{ role: 'user', content: prompt }] });
  let text = '';
  for (const b of res.content) if (b.type === 'text') text += b.text;
  if (!text.trim()) throw new Error('empty answer');
  return { text, model: res.model, tokensIn: res.usage.input_tokens, tokensOut: res.usage.output_tokens };
}

const why = (e: any) => (e?.name === 'TimeoutError' || /timed? ?out|abort/i.test(String(e?.message)) ? 'timed out' : String(e?.message || e).slice(0, 140));

export async function askBotModel(system: string, prompt: string): Promise<BotModelResult> {
  const tried: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    for (const m of HAIKU_MODELS) {
      try { return { ...(await haiku(m, system, prompt, 12000)), tried }; } catch (e) { tried.push(`${m}: ${why(e)}`); }
    }
  } else tried.push('no ANTHROPIC_API_KEY');
  if (process.env.GEMINI_API_KEY) {
    try { return { ...(await gemini(GEMINI_MODELS[0], system, prompt, 10000)), tried }; } catch (e) { tried.push(`${GEMINI_MODELS[0]}: ${why(e)}`); }
  } else tried.push('no GEMINI_API_KEY');
  throw new Error(`No model answered (${tried.join('; ')})`);
}
