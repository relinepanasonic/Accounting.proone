'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, X } from 'lucide-react';
import { requestInvoice } from '@/app/actions/sales-flow';
import { describeDuration, requestTotal, type DurationType, type RequestItem } from '@/lib/sales/flow';

export interface CatalogProduct {
  id: string;
  name: string;
  unit_price: number;
  scale: string | null;
  quantity: number | null;
  duration_type: DurationType | null;
  duration_value: number | null;
  deliverable_unit: string | null;
}

const field = 'bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-[#d4af37]/50';
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

/** The salesman picks what was sold. Accounting then turns it into the invoice. */
export function RequestInvoiceModal({
  dealId, clientName, products, initialItems, onClose,
}: {
  dealId: string;
  clientName: string;
  products: CatalogProduct[];
  initialItems?: RequestItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<RequestItem[]>(initialItems || []);
  const [note, setNote] = useState('');
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const addProduct = (id: string) => {
    if (id === '__custom__') {
      setItems((l) => [...l, { product_id: null, name: '', quantity: 1, unit_price: 0, scale: null, duration_type: 'none', duration_value: 0, deliverable_unit: null }]);
    } else {
      const p = products.find((x) => x.id === id);
      if (!p) return;
      setItems((l) => [
        ...l,
        {
          product_id: p.id,
          name: p.name,
          quantity: 1,
          unit_price: Number(p.unit_price || 0),
          scale: p.scale,
          duration_type: (p.duration_type || 'none') as DurationType,
          duration_value: Number(p.duration_value || 0),
          deliverable_unit: p.deliverable_unit,
        },
      ]);
    }
    setPick('');
  };
  const update = (i: number, patch: Partial<RequestItem>) => setItems((l) => l.map((it, k) => (k === i ? { ...it, ...patch } : it)));

  const submit = () =>
    start(async () => {
      setError('');
      const res = await requestInvoice(dealId, items, note);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onPointerDown={(e) => e.stopPropagation()}>
      <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900/50 sticky top-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 font-serif">Request invoice</h2>
            <p className="text-xs text-zinc-500">{clientName} · Accounting gets a notification with this list</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {items.length === 0 && <p className="text-sm text-zinc-500">Add the products the client bought.</p>}
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input className={`${field} flex-1`} value={it.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Product name" />
                <button onClick={() => setItems((l) => l.filter((_, k) => k !== i))} className="p-1.5 text-zinc-500 hover:text-red-400" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <label className="space-y-1"><span className="text-zinc-500 uppercase tracking-wider">Quantity</span>
                  <input type="number" min={1} className={`${field} w-full`} value={it.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) })} />
                </label>
                <label className="space-y-1"><span className="text-zinc-500 uppercase tracking-wider">Price each (Rp)</span>
                  <input type="number" min={0} className={`${field} w-full`} value={it.unit_price} onChange={(e) => update(i, { unit_price: Number(e.target.value) })} />
                </label>
                <div className="space-y-1"><span className="text-zinc-500 uppercase tracking-wider">Project length</span>
                  <div className="py-1.5 text-zinc-300">{describeDuration(it.duration_type, it.duration_value, it.deliverable_unit)}</div>
                </div>
              </div>
            </div>
          ))}

          <select value={pick} onChange={(e) => addProduct(e.target.value)} className={`${field} w-full`}>
            <option value="">+ Add a product from the catalog</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {rp(Number(p.unit_price || 0))}</option>)}
            <option value="__custom__">+ Custom item (not in the catalog)</option>
          </select>
          {products.length === 0 && <p className="text-[11px] text-amber-300">The product catalog is empty. Add products under Settings → Product Catalog, or use a custom item.</p>}

          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note for Accounting (discount, payment terms, anything special)" className={`${field} w-full`} />

          <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
            <span className="text-sm text-zinc-400">Total</span>
            <span className="font-mono text-lg font-bold text-[#f5d77f]">{rp(requestTotal(items))}</span>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button onClick={submit} disabled={pending || items.length === 0} className="w-full py-2.5 bg-gradient-to-r from-[#d4af37] to-[#f5d77f] rounded-lg text-black font-bold disabled:opacity-40 flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> {pending ? 'Sending...' : 'Send request to Accounting'}
          </button>
        </div>
      </div>
    </div>
  );
}
