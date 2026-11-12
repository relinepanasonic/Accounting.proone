import { renderPageAsImage } from 'unpdf';
import type { WeeklyPayload } from './weekly';
import { renderWeeklyPdf } from './weekly-pdf';

/**
 * The weekly report as a JPG (it is one page): the same PDF, drawn to an image on the server. WhatsApp shows an image inline in the chat,
 * where a PDF needs a tap. The PDF embeds its font (see weekly-pdf.tsx), so no fonts are needed on the server.
 */

export const IMAGE_SCALE = 2;       // A4 at 2x: about 1190 x 1684 px, sharp enough to read the small text
export const JPEG_QUALITY = 88;

/** Draws page 1 of a PDF to a JPG (white background). */
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
  return new Uint8Array(canvas.toBuffer('image/jpeg', opts.quality ?? JPEG_QUALITY));
}

export async function renderWeeklyJpeg(p: WeeklyPayload): Promise<Uint8Array> {
  return pdfToJpeg(new Uint8Array(await renderWeeklyPdf(p)));
}
