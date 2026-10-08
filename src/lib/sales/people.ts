// People a superadmin can hand a client to. Server-side only.
type Db = any;

export interface Person {
  id: string;
  name: string;
}

export async function loadHandlers(db: Db, workspaceId: string): Promise<{ advertisers: Person[]; admins: Person[] }> {
  const { data: members } = await db.from('workspace_members').select('user_id, role').eq('workspace_id', workspaceId).in('role', ['advertiser', 'admin', 'superadmin']);
  const ids = (members || []).map((m: any) => m.user_id);
  const { data: profiles } = ids.length ? await db.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] as any[] };
  const name = new Map<string, string>((profiles || []).map((p: any) => [p.id, p.full_name || p.email?.split('@')[0] || 'Staff']));
  // Superadmins can hold either job too, so they are in both lists.
  const pick = (role: string): Person[] =>
    (members || [])
      .filter((m: any) => m.role === role || m.role === 'superadmin')
      .map((m: any) => ({ id: m.user_id, name: name.get(m.user_id) || 'Staff' }))
      .sort((a: Person, b: Person) => a.name.localeCompare(b.name));
  return { advertisers: pick('advertiser'), admins: pick('admin') };
}
