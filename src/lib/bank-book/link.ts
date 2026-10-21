// Pure matching of Buku Bank lines to records that were reconciled earlier in Bank Reconcile (no database here).
// A reconciled record keeps "BANK-REF:<date>:<amount>:<text of the bank line>" in its bank_reference.

export interface LinkableLine { id: string; date: string; amount: number; counterparty: string; details?: string; notes?: string }
export interface ReconciledRecord { kind: 'transaction' | 'invoice'; id: string; invoiceId?: string | null; bankReference: string }

export interface ParsedRef { date: string; amount: number; text: string }

export function parseBankRef(ref: string | null | undefined): ParsedRef | null {
  const m = String(ref || '').match(/^BANK-REF:(\d{4}-\d{2}-\d{2}):(-?[\d.]+):([\s\S]*)$/);
  if (!m) return null;
  const amount = Number(m[2]);
  return Number.isFinite(amount) ? { date: m[1], amount, text: m[3] } : null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Which record each line was reconciled with: same day and amount; when several fit, the one whose bank text matches best. */
export function matchLines(lines: LinkableLine[], records: ReconciledRecord[]): Map<string, ReconciledRecord> {
  const byKey = new Map<string, Array<{ rec: ReconciledRecord; ref: ParsedRef }>>();
  for (const rec of records) {
    const ref = parseBankRef(rec.bankReference);
    if (!ref) continue;
    const key = `${ref.date}|${Math.round(ref.amount * 100)}`;
    (byKey.get(key) || byKey.set(key, []).get(key)!).push({ rec, ref });
  }
  const used = new Set<string>();
  const out = new Map<string, ReconciledRecord>();
  for (const l of lines) {
    const cands = (byKey.get(`${l.date}|${Math.round(l.amount * 100)}`) || []).filter((c) => !used.has(c.rec.id));
    if (cands.length === 0) continue;
    const name = norm(l.counterparty);
    const score = (c: { ref: ParsedRef }) => {
      const t = norm(c.ref.text);
      return name && t.includes(name) ? 2 : name && name.split(' ').some((w) => w.length > 3 && t.includes(w)) ? 1 : 0;
    };
    const best = [...cands].sort((a, b) => score(b) - score(a))[0];
    used.add(best.rec.id);
    out.set(l.id, best.rec);
  }
  return out;
}
