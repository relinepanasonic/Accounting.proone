import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { describeModelError } from '@/lib/ai/providers';
import { folderName, isFolder, isImage, listFolder } from '@/lib/ai/drive';
import {
  approveSample, chooseSample, createJob, ensureStudioTeam, getStudioState, interviewTurn, resumeJob, reviseSample, scanInput, setFolders, startSample, tickStudio,
} from '@/lib/ai/studio';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function GET(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const jobId = new URL(request.url).searchParams.get('jobId');
    return NextResponse.json(await getStudioState(access.supabase, access.workspaceId, jobId));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not load the Studio.' }, { status: 500 });
  }
}

/** One endpoint, one action per call: create, interview, browse, folders, scan, sample, start, approve, revise, resume, tick, team. */
export async function POST(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const action = str(body?.action, 30);
  const { supabase: db, workspaceId, userId } = access;
  const jobId = str(body?.jobId, 60);

  try {
    switch (action) {
      case 'create': {
        const id = await createJob(db, workspaceId, userId, str(body?.title, 120));
        await interviewTurn(db, workspaceId, id, null); // the Producer opens the interview
        return NextResponse.json({ jobId: id });
      }
      case 'interview':
        return NextResponse.json(await interviewTurn(db, workspaceId, jobId, str(body?.message, 4000)));
      case 'team':
        return NextResponse.json({ teamId: await ensureStudioTeam(db, workspaceId) });
      case 'browse': {
        const id = str(body?.folderId, 80) || 'root';
        const items = await listFolder(db, workspaceId, id);
        return NextResponse.json({
          folderId: id,
          name: await folderName(db, workspaceId, id),
          folders: items.filter(isFolder).map((f) => ({ id: f.id, name: f.name })),
          images: items.filter(isImage).length,
        });
      }
      case 'folders': {
        const i = body?.input;
        const o = body?.output;
        if (!i?.id || !o?.id) return NextResponse.json({ error: 'Choose both folders.' }, { status: 400 });
        await setFolders(db, workspaceId, jobId, { id: str(i.id, 80), name: str(i.name, 120) }, { id: str(o.id, 80), name: str(o.name, 120) });
        return NextResponse.json({ products: await scanInput(db, workspaceId, jobId) });
      }
      case 'scan':
        return NextResponse.json({ products: await scanInput(db, workspaceId, jobId) });
      case 'sample-product':
        await chooseSample(db, workspaceId, jobId, str(body?.productId, 60));
        return NextResponse.json({ ok: true });
      case 'start':
        await startSample(db, workspaceId, jobId);
        return NextResponse.json({ ok: true });
      case 'approve':
        await approveSample(db, workspaceId, jobId);
        return NextResponse.json({ ok: true });
      case 'revise':
        await reviseSample(db, workspaceId, jobId, str(body?.feedback, 1500));
        return NextResponse.json({ ok: true });
      case 'resume':
        await resumeJob(db, workspaceId, jobId);
        return NextResponse.json({ ok: true });
      case 'tick':
        return NextResponse.json(await tickStudio(db, workspaceId));
      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: describeModelError(err) || err?.message || 'Something went wrong.' }, { status: 400 });
  }
}
