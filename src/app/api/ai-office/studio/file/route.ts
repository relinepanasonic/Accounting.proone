import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { downloadFile } from '@/lib/ai/drive';

export const dynamic = 'force-dynamic';

/** Shows a generated picture from Google Drive inside the Studio (owners only; the picture never becomes public). */
export async function GET(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const assetId = new URL(request.url).searchParams.get('assetId') || '';
  const { data: asset } = await access.supabase.from('ai_studio_assets').select('drive_file_id').eq('id', assetId).eq('workspace_id', access.workspaceId).maybeSingle();
  if (!asset?.drive_file_id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const file = await downloadFile(access.supabase, access.workspaceId, asset.drive_file_id);
    return new NextResponse(new Uint8Array(file.data), { headers: { 'Content-Type': file.mimeType, 'Cache-Control': 'private, max-age=300' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not read the file.' }, { status: 502 });
  }
}
