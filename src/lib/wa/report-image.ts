import { renderPageAsImage } from 'unpdf';
import type { WeeklyPayload } from './weekly';
import { renderWeeklyPdf } from './weekly-pdf';

/**
 * The weekly report as a JPG (it is one page): the same PDF, drawn to an image on the server. WhatsApp shows an image inline in the chat,
 * where a PDF needs a tap. The PDF embeds its font (see weekly-pdf.tsx), so no fonts are needed on the server.
 *
 * Why the care: on a server without fonts (Vercel) a page whose text could not be drawn comes out with the boxes and charts but NO TEXT.
 * Two things made that happen, and both are handled here: pdf.js (in unpdf) calls Math.sumPrecise, which Node 24 does not have yet, and
 * fails to read the embedded font; and a font that is not embedded needs font files the server does not have. So: the function is
 * filled in below, the PDF embeds every font it uses, and an image with no text on it is never returned (the caller sends the PDF instead).
 */

export const IMAGE_SCALE = 2;       // A4 at 2x: about 1190 x 1684 px, sharp enough to read the small text
export const JPEG_QUALITY = 88;

// pdf.js uses Math.sumPrecise (a new JavaScript function). Node 24 does not have it: without it the embedded font is not read.
if (typeof (Math as any).sumPrecise !== 'function') {
  (Math as any).sumPrecise = (values: Iterable<number>) => { let t = 0; for (const v of values) t += v; return t; };
}

/** Share of the pixels that are dark (text and lines). A page with its text missing is nearly all white, boxes and bars apart. */
export function darkShare(rgba: Uint8ClampedArray | Uint8Array, step = 5): number {
  let dark = 0; let seen = 0;
  for (let i = 0; i < rgba.length; i += 4 * step) { seen++; if (rgba[i] < 90 && rgba[i + 1] < 90 && rgba[i + 2] < 90) dark++; }
  return seen ? dark / seen : 0;
}
export const MIN_DARK_SHARE = 0.004;     // a real report has about 2-5% (a blank-text one about 0.1%)

/** Draws page 1 of a PDF to a JPG (white background). Throws when the picture has no text, so a blank report is never sent. */
export async function pdfToJpeg(pdf: Uint8Array, opts: { scale?: number; quality?: number } = {}): Promise<Uint8Array> {
  // pdf.js takes ownership of the bytes it is given, so it gets its own copy.
  const png = await renderPageAsImage(pdf.slice(), 1, { canvasImport: () => import('@napi-rs/canvas'), scale: opts.scale ?? IMAGE_SCALE });
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const img = await loadImage(Buffer.from(png));
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, img.width, img.height);
  ctx.drawImage(img, 0, 0);
  const share = darkShare(ctx.getImageData(0, 0, img.width, img.height).data);
  if (share < MIN_DARK_SHARE) throw new Error(`The report image has no text on it (dark share ${(share * 100).toFixed(2)}%).`);
  return new Uint8Array(canvas.toBuffer('image/jpeg', opts.quality ?? JPEG_QUALITY));
}

export async function renderWeeklyJpeg(p: WeeklyPayload): Promise<Uint8Array> {
  return pdfToJpeg(new Uint8Array(await renderWeeklyPdf(p)));
}
