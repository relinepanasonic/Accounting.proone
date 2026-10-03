// Estimated AI spend. Pure functions: safe for server and client.
// Claude prices are Anthropic's list prices (USD per 1M tokens). Groq / Gemini prices are estimates for the
// cheap worker models (often free-tier), so the total is an estimate, not an invoice.

const PRICES: { match: (model: string) => boolean; input: number; output: number }[] = [
  { match: (m) => m.includes('opus'), input: 4, output: 20 },
  { match: (m) => m.includes('sonnet'), input: 2, output: 10 },
  { match: (m) => m.includes('haiku'), input: 1, output: 5 },
  { match: (m) => m.startsWith('groq/') || m.includes('gpt-oss'), input: 0.075, output: 0.3 },
  { match: (m) => m.endsWith(':free'), input: 0, output: 0 },
  { match: (m) => m.startsWith('zai/') && m.includes('flash'), input: 0, output: 0 },
  { match: (m) => m.startsWith('zai/') || m.includes('glm'), input: 0.6, output: 2.2 },
  { match: (m) => m.startsWith('openrouter/'), input: 0.3, output: 1 },
  { match: (m) => m.startsWith('gemini/') || m.includes('gemini'), input: 0.3, output: 2.5 },
];

/** USD for one task's tokens. Unknown models are priced like Sonnet so spend is never under-counted. */
export function costUsd(model: string | null | undefined, tokensIn: number, tokensOut: number): number {
  const m = String(model || '').toLowerCase();
  const p = PRICES.find((x) => x.match(m)) || { input: 2, output: 10 };
  return (Number(tokensIn || 0) * p.input + Number(tokensOut || 0) * p.output) / 1_000_000;
}

export const fmtUsd = (n: number) => `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`;

export const DEFAULT_MONTHLY_BUDGET_USD = 10;

/** First moment of the current month in Jakarta time, as an ISO timestamp. */
export function jakartaMonthStartIso(now = new Date()): string {
  const ym = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).format(now); // "2026-10"
  return new Date(`${ym}-01T00:00:00+07:00`).toISOString();
}
