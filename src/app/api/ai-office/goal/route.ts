import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { submitGoal } from '@/lib/ai/office-engine';
import { describeModelError, readImages } from '@/lib/ai/providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_IMAGES = 4;
const MAX_FILES = 3;
const MAX_IMAGE_CHARS = 2_500_000; // base64 length (about 1.8 MB of picture)

/** "data:image/jpeg;base64,...." -> parts, or null when it is not an image we accept. */
function parseImage(url: unknown) {
  const m = typeof url === 'string' ? /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(url) : null;
  if (!m || m[2].length > MAX_IMAGE_CHARS) return null;
  return { mediaType: m[1] as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: m[2] };
}

export async function POST(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  let brief = typeof body?.brief === 'string' ? body.brief.trim() : '';
  if (brief.length < 5) return NextResponse.json({ error: 'Write a brief for the boss first.' }, { status: 400 });
  if (brief.length > 8000) return NextResponse.json({ error: 'The brief is too long (max 8,000 characters).' }, { status: 400 });

  // Attachments become text inside the brief, so every agent can use them.
  const rawImages: unknown[] = Array.isArray(body?.images) ? body.images.slice(0, MAX_IMAGES) : [];
  const images = rawImages.map(parseImage);
  if (images.some((i) => !i)) return NextResponse.json({ error: 'One picture is too large or not a JPG, PNG, WebP or GIF.' }, { status: 400 });
  const files: { name: string; text: string }[] = (Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [])
    .map((f: any) => ({ name: String(f?.name || 'file').slice(0, 80), text: String(f?.text || '').slice(0, 12000) }))
    .filter((f: { text: string }) => f.text.trim());

  try {
    if (images.length > 0) {
      const { texts } = await readImages(images as NonNullable<ReturnType<typeof parseImage>>[]);
      brief += texts.map((t, i) => `\n\n--- Attached picture ${i + 1} (text read from the image) ---\n${t.slice(0, 6000)}`).join('');
    }
    for (const f of files) brief += `\n\n--- Attached file: ${f.name} ---\n${f.text}`;

    const id = await submitGoal(access.supabase, access.workspaceId, access.userId, brief, Boolean(body?.deepThink), typeof body?.teamId === 'string' ? body.teamId : null);
    return NextResponse.json({ id });
  } catch (err: any) {
    return NextResponse.json({ error: images.length ? describeModelError(err) : err?.message || 'Could not save the brief.' }, { status: 500 });
  }
}
