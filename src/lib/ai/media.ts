// Image generation for the AI Studio (Google Gemini image model, "Nano Banana"). Server-side only.
// The model id and the price estimate can be changed with environment variables when Google ships a newer one.
import sharp from 'sharp';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
/** Estimated USD per generated image (shown in the Studio; not an invoice). */
export const IMAGE_COST_USD = Number(process.env.GEMINI_IMAGE_COST_USD || 0.04);

export const mediaKeyReady = () => Boolean(process.env.GEMINI_API_KEY);

export interface RefImage {
  mimeType: string;
  /** base64 */
  data: string;
}

/** Shrinks a product photo so the request stays small: longest side 1280px, JPEG. */
export async function prepareRef(buf: Buffer): Promise<RefImage> {
  const out = await sharp(buf).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return { mimeType: 'image/jpeg', data: out.toString('base64') };
}

/** One marketing image from a prompt plus the product photo(s) as reference. Square (Shopee). */
export async function generateImage(opts: { prompt: string; refs: RefImage[] }): Promise<{ data: Buffer; mimeType: string; costUsd: number }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set, so images cannot be generated.');

  const parts: any[] = [
    ...opts.refs.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.data } })),
    { text: opts.prompt },
  ];
  const res = await fetch(`${BASE}/models/${IMAGE_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
    }),
    signal: AbortSignal.timeout(55_000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini image answered ${res.status}: ${String(json?.error?.message || '').slice(0, 200) || 'no detail'}`);

  const outParts: any[] = json?.candidates?.[0]?.content?.parts || [];
  const img = outParts.find((p) => p.inlineData?.data || p.inline_data?.data);
  const inline = img?.inlineData || img?.inline_data;
  if (!inline?.data) {
    const why = json?.candidates?.[0]?.finishReason || json?.promptFeedback?.blockReason || 'no image in the answer';
    throw new Error(`The image model returned no picture (${why}).`);
  }
  return { data: Buffer.from(inline.data, 'base64'), mimeType: inline.mimeType || inline.mime_type || 'image/png', costUsd: IMAGE_COST_USD };
}
