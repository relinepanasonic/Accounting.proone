import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearCache } from './cache';

const rows: Record<string, any> = {};
const inserts: Array<{ table: string; row: any }> = [];
const updates: Array<{ table: string; row: any }> = [];
const deletes: string[] = [];
let failInsert: string | null = null;

vi.mock('@/lib/api/supabase-admin', () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ download: async () => ({ data: null, error: { message: 'missing' } }), createSignedUploadUrl: async (p: string) => ({ data: { token: 't', path: p }, error: null }) }) },
    from: (table: string) => {
      let insertRow: any = null;
      const chain: any = {
        select: () => chain, eq: () => chain, not: () => chain, is: () => chain, in: () => chain, order: () => chain, limit: () => chain,
        insert: (row: any) => { insertRow = row; inserts.push({ table, row }); return chain; },
        update: (row: any) => { updates.push({ table, row }); return chain; },
        delete: () => { deletes.push(table); return chain; },
        upsert: () => chain,
        single: async () => (failInsert === table ? { data: null, error: { message: `${table} refused` } } : { data: { id: `${table}-new`, name: insertRow?.name, phone: insertRow?.phone }, error: null }),
        maybeSingle: async () => ({ data: typeof rows[table] === 'function' ? rows[table]() : rows[table] ?? null }),
        then: (res: any) => res({ data: Array.isArray(rows[`${table}[]`]) ? rows[`${table}[]`] : [], error: null }),
      };
      return chain;
    },
  }),
}));
vi.mock('@/lib/wa/send-media', () => ({ sendMedia: vi.fn(async () => ({ ok: true, detail: 'ok', mode: 'link', stored: true })), asDelivery: () => 'link' }));
vi.mock('@/lib/wa/media-storage', () => ({ adminMediaStorage: () => ({}) }));
vi.mock('@/lib/wa/report-image', () => ({ normalizeJpeg: async (b: Uint8Array) => b }));
import { addReminder, createLeadFromChat, moveDealStage, sendChatImage, setChatLabels, setReminderDone } from './crm-data';

const SALES = { userId: 'u-rani', name: 'Rani', role: 'sales' };
const ADMIN = { userId: 'u-admin', name: 'Nico', role: 'admin' };
const ins = (t: string) => inserts.filter((i) => i.table === t).map((i) => i.row);

beforeEach(() => {
  clearCache();
  for (const k of Object.keys(rows)) delete rows[k];
  inserts.length = 0; updates.length = 0; deletes.length = 0; failInsert = null;
  rows.wa_groups = { id: 'g1', wa_id: '628111222333', name: 'Budi Santoso', device_id: 'd1', is_group: false };
  rows.wa_devices = { role: 'sales', phone: '6285758789999' };
  rows.profiles = { full_name: 'Rani Putri', email: 'rani@x.test' };
  rows.chat_state = { source_label: 'Meta Ads: Promo Sultan', source_channel: 'meta_ads', first_message: 'Halo kak dari iklan', first_message_at: '2026-11-13T04:00:00Z' };
  rows['clients[]'] = [];
});

describe('createLeadFromChat', () => {
  it('a new number becomes a prospect client (with the chat phone and the lead source) and a deal in "Lead" owned by the salesperson', async () => {
    const r = await createLeadFromChat('w1', 'g1', { title: 'Paket Sultan', value: 'Rp 4.000.000' }, SALES);
    expect(r).toMatchObject({ ok: true, newClient: true, dealId: 'crm_deals-new' });
    expect(ins('clients')[0]).toMatchObject({ workspace_id: 'w1', name: 'Budi Santoso', phone: '+628111222333', is_prospect: true, contact_type: 'client', created_by: 'u-rani', lead_source: 'Meta Ads: Promo Sultan', lead_channel: 'meta_ads', first_contact_message: 'Halo kak dari iklan' });
    expect(ins('crm_deals')[0]).toMatchObject({ stage: 'Lead', title: 'Paket Sultan', value: 4000000, salesman_id: 'u-rani', salesman_name: 'Rani Putri', lead_name: 'Budi Santoso' });
  });

  it('a number that is already a client only gets a new deal (no duplicate client)', async () => {
    rows['clients[]'] = [{ id: 'k1', name: 'Toko Budi', phone: '0811-1222-333' }];
    const r = await createLeadFromChat('w1', 'g1', {}, SALES);
    expect(r).toMatchObject({ ok: true, newClient: false, clientId: 'k1' });
    expect(ins('clients')).toHaveLength(0);
    expect(ins('crm_deals')[0]).toMatchObject({ client_id: 'k1', lead_name: 'Toko Budi', title: 'Lead from WhatsApp' });
  });

  it('a salesperson always owns the lead they make; an admin may give it to someone', async () => {
    await createLeadFromChat('w1', 'g1', { salesmanId: '0cfec0a9-d7b6-49ea-9cfb-a7d7b3c30d17' }, SALES);
    expect(ins('crm_deals')[0].salesman_id).toBe('u-rani');
    inserts.length = 0;
    await createLeadFromChat('w1', 'g1', { salesmanId: '0cfec0a9-d7b6-49ea-9cfb-a7d7b3c30d17' }, ADMIN);
    expect(ins('crm_deals')[0].salesman_id).toBe('0cfec0a9-d7b6-49ea-9cfb-a7d7b3c30d17');
  });

  it('when the deal cannot be saved, the new prospect client is removed again (no orphan)', async () => {
    failInsert = 'crm_deals';
    const r = await createLeadFromChat('w1', 'g1', {}, SALES);
    expect(r).toMatchObject({ ok: false, status: 500 });
    expect(deletes).toContain('clients');
  });

  it('refuses a chat that is not on the sales number (a group, or the admin number)', async () => {
    rows.wa_devices = { role: 'admin' };
    expect(await createLeadFromChat('w1', 'g1', {}, SALES)).toMatchObject({ ok: false, status: 404 });
    rows.wa_devices = { role: 'sales' };
    rows.wa_groups = { ...rows.wa_groups, is_group: true };
    expect(await createLeadFromChat('w1', 'g1', {}, SALES)).toMatchObject({ ok: false, status: 404 });
  });
});

describe('moveDealStage', () => {
  it('moves the salesperson\'s own deal; refuses another salesperson\'s, an invoiced deal, and the stages only the ERP sets', async () => {
    rows.crm_deals = { id: 'd1', stage: 'Lead', salesman_id: 'u-rani' };
    expect(await moveDealStage('w1', 'd1', 'Contacted', SALES)).toEqual({ ok: true });
    expect(updates.find((u) => u.table === 'crm_deals')!.row).toMatchObject({ stage: 'Contacted' });
    rows.crm_deals = { id: 'd1', stage: 'Lead', salesman_id: 'u-other' };
    expect(await moveDealStage('w1', 'd1', 'Contacted', SALES)).toMatchObject({ ok: false, status: 403 });
    expect(await moveDealStage('w1', 'd1', 'Contacted', ADMIN)).toEqual({ ok: true });
    rows.crm_deals = { id: 'd1', stage: 'Invoice', salesman_id: 'u-rani' };
    expect(await moveDealStage('w1', 'd1', 'Negotiation', ADMIN)).toMatchObject({ ok: false });
    expect(await moveDealStage('w1', 'd1', 'Deal', ADMIN)).toMatchObject({ ok: false, status: 400 });
  });
});

describe('reminders', () => {
  const future = new Date(Date.now() + 2 * 86400000).toISOString();
  it('a reminder is saved for the person who set it, and the same follow-up becomes an ERP task on that Jakarta day', async () => {
    const r = await addReminder('w1', 'g1', { dueAt: future, note: 'Tanya omzet' }, SALES);
    expect(r).toMatchObject({ ok: true });
    expect(ins('staff_tasks')[0]).toMatchObject({ workspace_id: 'w1', assigned_to: 'u-rani', assigned_by: 'u-rani', status: 'open', title: 'Follow up WhatsApp: Budi Santoso' });
    expect(ins('staff_tasks')[0].due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ins('chat_reminders')[0]).toMatchObject({ group_id: 'g1', note: 'Tanya omzet', assigned_to: 'u-rani', assigned_name: 'Rani', staff_task_id: 'staff_tasks-new' });
  });
  it('refuses a time that has passed, and a person outside the team', async () => {
    expect(await addReminder('w1', 'g1', { dueAt: '2020-01-01T00:00:00Z' }, SALES)).toMatchObject({ ok: false, status: 400 });
    rows.workspace_members = null;
    expect(await addReminder('w1', 'g1', { dueAt: future, assignTo: 'u-stranger' }, SALES)).toMatchObject({ ok: false, error: expect.stringMatching(/not in the team/) });
  });
  it('marking it done also closes the ERP task', async () => {
    rows.chat_reminders = { id: 'r1', staff_task_id: 't1' };
    expect(await setReminderDone('w1', 'r1', true, SALES)).toEqual({ ok: true });
    expect(updates.find((u) => u.table === 'chat_reminders')!.row).toMatchObject({ done_by: 'Rani' });
    expect(updates.find((u) => u.table === 'staff_tasks')!.row).toMatchObject({ status: 'done' });
  });
});

describe('labels and images', () => {
  it('a chat only gets labels that exist', async () => {
    rows['chat_labels[]'] = [{ id: 'l1', name: 'Hot', color: 'red' }, { id: 'l2', name: 'VIP', color: 'amber' }];
    const r: any = await setChatLabels('w1', 'g1', ['l1', 'nope']);
    expect(r.labels).toEqual([{ id: 'l1', name: 'Hot', color: 'red' }]);
    expect(ins('chat_label_links')[0]).toEqual([{ group_id: 'g1', label_id: 'l1', workspace_id: 'w1' }]);
  });
  it('only a picture uploaded for THIS chat can be sent from it', async () => {
    process.env.FONNTE_TOKEN_SALES = 'tok';
    expect(await sendChatImage('w1', 'g1', { path: 'chat/w1/g2/out-x.jpg' }, SALES)).toMatchObject({ ok: false, status: 400 });
    expect(await sendChatImage('w1', 'g1', { path: 'chat/w1/g1/../g2/out-x.jpg' }, SALES)).toMatchObject({ ok: false, status: 400 });
    expect(await sendChatImage('w1', 'g1', { path: 'chat/w1/g1/out-x.jpg' }, SALES)).toMatchObject({ ok: false, error: expect.stringMatching(/not found/) });
  });
});
