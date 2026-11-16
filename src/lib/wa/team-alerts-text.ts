/**
 * The WhatsApp messages the team gets when work waits for them: an ACC for a negotiation (Herlan or Nico), and an invoice to make (Lucy and Nico).
 * Pure, so the wording is tested. Each ends with the link to the page in the ERP where the person acts.
 */
export const ERP_LINK = 'https://erp.profesoronline.id';

const rp = (n: number) => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
const clip = (s: string, n: number) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 3).trimEnd()}...` : t; };

export function accRequestText(i: { client: string; title: string; value: number; sales: string; lastNote?: string | null }): string {
  return [
    '*Permintaan ACC Negosiasi*',
    `Client: ${clip(i.client, 60)}`,
    `Deal: ${clip(i.title, 80)}${i.value > 0 ? ` (${rp(i.value)})` : ''}`,
    `Sales: ${clip(i.sales || '-', 40)}`,
    i.lastNote ? `Catatan negosiasi: ${clip(i.lastNote, 220)}` : '',
    '',
    'Mohon di-ACC atau dikembalikan dengan komentar. Cukup salah satu (Herlan atau Nico).',
    `${ERP_LINK}/sales/pipeline`,
  ].filter((l, k, a) => l !== '' || (k > 0 && a[k - 1] !== '')).join('\n');
}

export function invoiceRequestText(i: { client: string; sales: string; items: Array<{ name: string; quantity: number }>; total: number; note?: string | null }): string {
  const lines = i.items.slice(0, 5).map((x) => `- ${clip(x.name, 60)} x${x.quantity}`);
  return [
    '*Permintaan Buat Invoice*',
    `Client: ${clip(i.client, 60)}`,
    `Sales: ${clip(i.sales || '-', 40)}`,
    ...lines,
    i.items.length > 5 ? `- dan ${i.items.length - 5} produk lain` : '',
    `Total: ${rp(i.total)}`,
    i.note ? `Catatan: ${clip(i.note, 200)}` : '',
    '',
    'Mohon dibuatkan invoicenya di ERP:',
    `${ERP_LINK}/invoices/requests`,
  ].filter((l, k, a) => l !== '' || (k > 0 && a[k - 1] !== '')).join('\n');
}
