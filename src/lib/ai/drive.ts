// Google Drive for the AI Studio: the owner signs in once with Google (OAuth), the refresh token is kept on the server.
// Server-side only. Plain REST calls, no extra packages.
type Db = any;

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
// Full Drive scope: the Studio must read product photos that already exist and write the results next to them.
const SCOPES = ['https://www.googleapis.com/auth/drive', 'openid', 'email'].join(' ');

export const driveEnvReady = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const redirectUriFor = (origin: string) => `${origin}/api/ai-office/drive/callback`;

export function authUrl(origin: string, state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUriFor(origin),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // always ask, so Google always returns a refresh token
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

export async function exchangeCode(origin: string, code: string): Promise<{ refreshToken: string; accessToken: string; email: string | null }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUriFor(origin),
      grant_type: 'authorization_code',
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`Google sign-in failed: ${json.error_description || json.error || res.status}`);
  if (!json.refresh_token) throw new Error('Google did not return a refresh token. Remove the app at myaccount.google.com/permissions and connect again.');
  let email: string | null = null;
  try {
    const u: any = await (await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${json.access_token}` } })).json();
    email = u?.email || null;
  } catch { /* the email is only for display */ }
  return { refreshToken: json.refresh_token, accessToken: json.access_token, email };
}

const tokenCache = new Map<string, { token: string; until: number }>();

async function accessToken(db: Db, workspaceId: string): Promise<string> {
  const hit = tokenCache.get(workspaceId);
  if (hit && hit.until > Date.now() + 30_000) return hit.token;

  const { data, error } = await db.from('ai_integrations').select('refresh_token').eq('workspace_id', workspaceId).eq('provider', 'google_drive').maybeSingle();
  if (error) throw new Error('Studio tables are missing. Run supabase/migrations/20261008_ai_studio.sql first.');
  if (!data?.refresh_token) throw new Error('Google Drive is not connected yet. Press "Connect Google Drive" in the Studio tab.');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`Google Drive sign-in expired (${json.error || res.status}). Connect it again in the Studio tab.`);
  tokenCache.set(workspaceId, { token: json.access_token, until: Date.now() + Number(json.expires_in || 3600) * 1000 });
  return json.access_token;
}

async function drive(db: Db, workspaceId: string, url: string, init: RequestInit = {}) {
  const token = await accessToken(db, workspaceId);
  const res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const detail = (await res.text()).replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(`Google Drive answered ${res.status}: ${detail}`);
  }
  return res;
}

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
}

export const isFolder = (i: { mimeType: string }) => i.mimeType === 'application/vnd.google-apps.folder';
export const isImage = (i: { mimeType: string }) => /^image\/(jpeg|png|webp)$/.test(i.mimeType);

/** Everything directly inside a folder ('root' = My Drive), folders first. */
export async function listFolder(db: Db, workspaceId: string, folderId: string): Promise<DriveItem[]> {
  const out: DriveItem[] = [];
  let pageToken = '';
  do {
    const q = `'${folderId.replace(/'/g, '')}' in parents and trashed = false`;
    const params = new URLSearchParams({ q, fields: 'nextPageToken, files(id, name, mimeType)', pageSize: '200', orderBy: 'folder,name', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
    if (pageToken) params.set('pageToken', pageToken);
    const json: any = await (await drive(db, workspaceId, `${API}/files?${params}`)).json();
    out.push(...(json.files || []));
    pageToken = json.nextPageToken || '';
  } while (pageToken && out.length < 600);
  return out;
}

export async function folderName(db: Db, workspaceId: string, folderId: string): Promise<string> {
  if (folderId === 'root') return 'My Drive';
  const json: any = await (await drive(db, workspaceId, `${API}/files/${folderId}?fields=name&supportsAllDrives=true`)).json();
  return json.name || 'Folder';
}

export async function downloadFile(db: Db, workspaceId: string, fileId: string): Promise<{ data: Buffer; mimeType: string }> {
  const meta: any = await (await drive(db, workspaceId, `${API}/files/${fileId}?fields=mimeType&supportsAllDrives=true`)).json();
  const res = await drive(db, workspaceId, `${API}/files/${fileId}?alt=media&supportsAllDrives=true`);
  return { data: Buffer.from(await res.arrayBuffer()), mimeType: meta.mimeType || 'application/octet-stream' };
}

export async function createFolder(db: Db, workspaceId: string, name: string, parentId: string): Promise<string> {
  const res = await drive(db, workspaceId, `${API}/files?supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  return ((await res.json()) as any).id as string;
}

/** The folder called `name` inside `parentId`, created when it does not exist yet. */
export async function ensureFolder(db: Db, workspaceId: string, name: string, parentId: string): Promise<string> {
  const q = `'${parentId.replace(/'/g, '')}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const json: any = await (await drive(db, workspaceId, `${API}/files?${new URLSearchParams({ q, fields: 'files(id)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })}`)).json();
  if (json.files?.[0]?.id) return json.files[0].id;
  return createFolder(db, workspaceId, name, parentId);
}

export async function uploadFile(db: Db, workspaceId: string, opts: { name: string; mimeType: string; data: Buffer; parentId: string }): Promise<string> {
  const boundary = `studio${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name: opts.name, parents: [opts.parentId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${opts.mimeType}\r\n\r\n`),
    opts.data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await drive(db, workspaceId, `${UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: new Uint8Array(body),
  });
  return ((await res.json()) as any).id as string;
}

/** Moves a file to the Drive trash (the owner can still restore it). */
export async function trashFile(db: Db, workspaceId: string, fileId: string): Promise<void> {
  await drive(db, workspaceId, `${API}/files/${fileId}?supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}
