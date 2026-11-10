// The PIC (person in charge, clients.contact_name) and the billing address (clients.billing_address) of each client.
// Read on their own so a database without a column still shows the tables.
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

export async function loadClientAddresses(db: Db, clientIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < clientIds.length; i += 200) {
    const { data, error } = await db.from('clients').select('id, billing_address').in('id', clientIds.slice(i, i + 200));
    if (error) return out;
    for (const c of data || []) if (c.billing_address) out.set(c.id, String(c.billing_address));
  }
  return out;
}
