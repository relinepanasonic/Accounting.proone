// Browser-only: turns the off-screen report blocks into a multi-page A4 PDF.
// Same technique as the invoice PDF (dom-to-image-more + jsPDF), but block by block so tables are not cut in half.

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const SCALE = 2;

async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
    )
  );
}

export async function buildReportPdf(root: HTMLElement): Promise<Blob> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-block]'));
  if (blocks.length === 0) throw new Error('Nothing to put in the PDF.');

  await waitForImages(root);

  const domtoimage = (await import('dom-to-image-more')).default;
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = 0; // how far down the current page we are, in mm
  let firstBlock = true;

  for (const el of blocks) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const dataUrl = await domtoimage.toJpeg(el, {
      quality: 0.82,
      bgcolor: '#ffffff',
      width: w * SCALE,
      height: h * SCALE,
      style: { transform: `scale(${SCALE})`, transformOrigin: 'top left', width: `${w}px`, height: `${h}px` },
    });

    const hMm = (h * PAGE_W_MM) / w;

    if (hMm <= PAGE_H_MM) {
      // Fits on one page: start a new page if it does not fit in what is left of this one.
      if (!firstBlock && y + hMm > PAGE_H_MM) {
        pdf.addPage();
        y = 0;
      }
      pdf.addImage(dataUrl, 'JPEG', 0, y, PAGE_W_MM, hMm, undefined, 'FAST');
      y += hMm;
    } else {
      // Taller than a page (a very long table): slice it across pages.
      if (!firstBlock) {
        pdf.addPage();
        y = 0;
      }
      let offset = 0;
      while (offset < hMm) {
        if (offset > 0) pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', 0, -offset, PAGE_W_MM, hMm, undefined, 'FAST');
        offset += PAGE_H_MM;
      }
      y = hMm - Math.floor(hMm / PAGE_H_MM) * PAGE_H_MM;
    }
    firstBlock = false;
  }

  return pdf.output('blob');
}

/** Saves a blob as a file in the browser. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
