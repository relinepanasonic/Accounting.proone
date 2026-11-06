// The PIC (person in charge) of each client: clients.contact_name. Read on its own so a database without that column still shows the tables.
type Db = any;

export async function loadClientPics(db: Db, clientIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < clientIds.length; i += 200) {
    const { data, error } = await db.from('clients').select('id, contact_name').in('id', clientIds.slice(i, i + 200));
    if (error) return out;
    for (const c of data || []) if (c.contact_name) out.set(c.id, String(c.contact_name));
  }
  return out;
}
