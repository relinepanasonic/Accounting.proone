// Screenshots of one saved session: up to MAX_SHOTS per section (GMV Max Auto, each group, Iklan Mandiri).
// They live in the existing `screenshot_url` text column as JSON, so no database change is needed.
// An old session holds one plain image: it is read as { all: [image] }.

export const MAX_SHOTS = 4;
export type Shots = Record<string, string[]>;

export const GMV_KEY = 'gmv';
export const MANDIRI_KEY = 'mandiri';
export const groupKey = (category: string, name: string) => `g:${category}|${name}`;

export function shotLabel(key: string): string {
  if (key === GMV_KEY) return 'GMV Max Auto';
  if (key === MANDIRI_KEY) return 'Iklan Mandiri';
  if (key === 'all') return 'Screenshot';
  if (key.startsWith('g:')) return key.slice(2).split('|')[1] || 'Group';
  return key;
}

export function parseShots(raw: string | null | undefined): Shots {
  if (!raw) return {};
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)?.s;
      if (parsed && typeof parsed === 'object') {
        const out: Shots = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (Array.isArray(v) && v.length) out[k] = v.filter((x) => typeof x === 'string').slice(0, MAX_SHOTS);
        }
        return out;
      }
    } catch {
      /* fall through: unreadable, show nothing */
    }
    return {};
  }
  return { all: [raw] };
}

export function serializeShots(shots: Shots): string | null {
  const s: Shots = {};
  for (const [k, v] of Object.entries(shots)) if (v.length) s[k] = v.slice(0, MAX_SHOTS);
  return Object.keys(s).length ? JSON.stringify({ v: 2, s }) : null;
}

export const allShots = (shots: Shots) => Object.values(shots).flat();

/** Browser only: shrink a pasted image to at most 1100px wide, JPEG, so a session stays light. */
export function compressImage(file: Blob, maxWidth = 1100, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the image'));
    };
    img.src = url;
  });
}
