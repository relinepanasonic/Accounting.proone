import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { submitGoal } from '@/lib/ai/office-engine';
import { describeModelError, readImages, type ImageMode } from '@/lib/ai/providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_IMAGES = 4;
const MAX_DESIGN = 3; // design pictures are re-sent to the agents on every step, so keep them few
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

  // Pictures: 'text' ones are read into words; 'design' ones are also described AND kept, so agents that can see get the picture itself.
  const rawImages: any[] = Array.isArray(body?.images) ? body.images.slice(0, MAX_IMAGES) : [];
  const parsed = rawImages.map((raw) => {
    const p = parseImage(typeof raw === 'string' ? raw : raw?.url);
    return p ? { ...p, mode: (raw?.mode === 'design' ? 'design' : 'text') as ImageMode } : null;
  });
  if (parsed.some((p) => !p)) return NextResponse.json({ error: 'One picture is too large or not a JPG, PNG, WebP or GIF.' }, { status: 400 });
  const pics = parsed as NonNullable<(typeof parsed)[number]>[];
  const design = pics.filter((p) => p.mode === 'design');
  if (design.length > MAX_DESIGN) return NextResponse.json({ error: `Up to ${MAX_DESIGN} design references per brief.` }, { status: 400 });
  if (design.length > 0) {
    const probe = await access.supabase.from('ai_task_images').select('id').limit(1);
    if (probe.error) return NextResponse.json({ error: 'Design references need one database step: run supabase/migrations/20261006_ai_task_images.sql in Supabase.' }, { status: 400 });
  }

  const files: { name: string; text: string }[] = (Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [])
    .map((f: any) => ({ name: String(f?.name || 'file').slice(0, 80), text: String(f?.text || '').slice(0, 12000) }))
    .filter((f: { text: string }) => f.text.trim());

  try {
    if (pics.length > 0) {
      const { texts } = await readImages(pics);
      brief += texts
        .map((t, i) => `\n\n--- Attached picture ${i + 1} (${pics[i].mode === 'design' ? 'design reference, described in words' : 'text read from the image'}) ---\n${t.slice(0, 6000)}`)
        .join('');
    }
    for (const f of files) brief += `\n\n--- Attached file: ${f.name} ---\n${f.text}`;

    const id = await submitGoal(access.supabase, access.workspaceId, access.userId, brief, Boolean(body?.deepThink), typeof body?.teamId === 'string' ? body.teamId : null);
    if (design.length > 0) {
      const { error } = await access.supabase
        .from('ai_task_images')
        .insert(design.map((p) => ({ workspace_id: access.workspaceId, task_id: id, media_type: p.mediaType, data: p.data })));
      if (error) return NextResponse.json({ error: `The brief was saved but the design pictures were not: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ id });
  } catch (err: any) {
    return NextResponse.json({ error: pics.length ? describeModelError(err) : err?.message || 'Could not save the brief.' }, { status: 500 });
  }
}
