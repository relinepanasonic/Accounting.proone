'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createLead } from '@/app/actions/sales-flow';

const field = 'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#d4af37]/50';
const label = 'block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5';

/**
 * A new lead is entered with the SAME client form Accounting uses, so nothing has to be re-typed later.
 * The client stays hidden from Accounting until the salesman requests an invoice.
 */
export function NewLeadModal({ salesmen, canPickSalesman }: { salesmen: { id: string; name: string }[]; canPickSalesman: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) || '');
    setError('');
    start(async () => {
      const res = await createLead({
        name: g('name'),
        contact_name: g('contact_name'),
        email: g('email'),
        phone: g('phone'),
        company_name: g('company_name'),
        company_legal_name: g('company_legal_name'),
        billing_address: g('billing_address'),
        title: g('title'),
        value: Number(g('value').replace(/[^\d]/g, '')) || 0,
        expected_close_date: g('expected_close_date'),
        notes: g('notes'),
        salesman_id: g('salesman_id') || undefined,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-gradient-to-r from-[#d4af37] to-[#f5d77f] text-black text-sm font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center shadow-lg"
      >
        <Plus className="w-4 h-4 mr-2" /> New Lead
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-[0_0_40px_rgba(212,175,55,0.15)]">
            <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900/50 sticky top-0">
              <h2 className="text-lg font-bold text-zinc-100 font-serif">New lead</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white p-1" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={submit} className="p-4 space-y-5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#d4af37] mb-3">Client (same form as Accounting)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2"><label className={label}>Client name *</label><input name="name" required className={field} placeholder="Brand or person" /></div>
                  <div><label className={label}>Contact person</label><input name="contact_name" className={field} /></div>
                  <div><label className={label}>Phone / WhatsApp</label><input name="phone" className={field} placeholder="08xxxxxxxxxx" /></div>
                  <div><label className={label}>Email</label><input name="email" type="email" className={field} /></div>
                  <div><label className={label}>Company / brand</label><input name="company_name" className={field} /></div>
                  <div className="sm:col-span-2"><label className={label}>Company legal name</label><input name="company_legal_name" className={field} placeholder="PT ... (for the invoice)" /></div>
                  <div className="sm:col-span-2"><label className={label}>Billing address</label><textarea name="billing_address" rows={2} className={field} /></div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#d4af37] mb-3">Deal</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2"><label className={label}>What is the deal about? *</label><input name="title" required className={field} placeholder="e.g. Shopee ads management, 3 months" /></div>
                  <div><label className={label}>Expected value (Rp)</label><input name="value" inputMode="numeric" className={field} placeholder="e.g. 5000000" /></div>
                  <div><label className={label}>Expected close date</label><input name="expected_close_date" type="date" className={`${field} [color-scheme:dark]`} /></div>
                  {canPickSalesman && (
                    <div className="sm:col-span-2">
                      <label className={label}>Salesman</label>
                      <select name="salesman_id" className={field} defaultValue="">
                        <option value="">Me</option>
                        {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="sm:col-span-2"><label className={label}>Notes</label><textarea name="notes" rows={2} className={field} /></div>
                </div>
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}
              <button type="submit" disabled={pending} className="w-full py-2.5 bg-gradient-to-r from-[#d4af37] to-[#f5d77f] rounded-lg text-black font-bold hover:opacity-90 disabled:opacity-50">
                {pending ? 'Saving...' : 'Create lead'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
