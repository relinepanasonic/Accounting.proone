'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Check, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { createInvoice } from '@/app/actions/invoices';
import { RupiahInput } from '@/components/ui/RupiahInput';
import { BulletTextarea } from '@/components/ui/BulletTextarea';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CatalogProductOption {
  id: string;
  name: string;
  description?: string;
  unit_price: number;
}

interface NewInvoiceFormProps {
  clients: Array<{ id: string; name: string }>;
  products?: CatalogProductOption[];
}

export function NewInvoiceForm({ clients, products = [] }: NewInvoiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const getNet15Date = () => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  };

  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [invoiceNumber, setInvoiceNumber] = useState(() => `INV-2026-${Math.floor(100 + Math.random() * 900)}`);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(getNet15Date);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: '1',
      description: 'TikTok Live Commerce Monthly Production Retainer',
      quantity: 1,
      unitPrice: 85000000,
    },
    {
      id: '2',
      description: 'Custom HD Video Creator Package (40 Ads)',
      quantity: 40,
      unitPrice: 1621750,
    },
  ]);

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        description: 'New Deliverable Line Item',
        quantity: 1,
        unitPrice: 1000,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const handleUpdateItem = (
    id: string,
    field: keyof LineItem,
    value: string | number
  ) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSelectProduct = (rowId: string, productId: string) => {
    if (!productId || productId === 'custom') return;
    const prod = products?.find((p) => p.id === productId);
    if (prod) {
      setLineItems((prev) =>
        prev.map((item) =>
          item.id === rowId
            ? {
                ...item,
                description: prod.description ? `${prod.name}\n${prod.description}` : prod.name,
                unitPrice: Number(prod.unit_price) || 0,
              }
            : item
        )
      );
    }
  };

  const grandTotal = lineItems.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice,
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setErrorMsg('Please select a client.');
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await createInvoice({
          clientId,
          invoiceNumber,
          issueDate,
          dueDate,
          notes,
          lineItems: lineItems.map((l) => ({
            description: l.description,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
          })),
        });

        if (!res.success) {
          setErrorMsg(res.error || 'Failed to create invoice. Please verify your workspace permission.');
          return;
        }

        if (res.invoiceId) {
          router.push(`/invoices/${res.invoiceId}`);
        } else {
          router.push('/invoices');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'An unexpected error occurred while saving.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/60 text-[#f5d77f] text-xs font-mono shadow-[0_0_20px_rgba(212,175,55,0.25)]">
          <AlertCircle className="w-5 h-5 shrink-0 text-[#f5d77f]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Top Invoice Metadata Panel */}
      <div className="gold-glass-panel rounded-2xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Select Client Payee *
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37] font-sans"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Invoice Reference ID *
            </label>
            <input
              type="text"
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-[#f5d77f] font-mono font-bold focus:outline-none focus:border-[#d4af37]"
            />
          </div>
        </div>

        {/* Issue Date & Due Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Issue Date
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37] font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Due Date (Auto Net-15 Terms)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-[#f5d77f] focus:outline-none focus:border-[#d4af37] font-mono"
            />
          </div>
        </div>
      </div>

      {/* Dynamic Deliverables Line Items Panel */}
      <div className="gold-glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              DELIVERABLE LINE ITEMS & SUBTOTALS
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
              INSTANT CLIENT-SIDE CALCULATION ENGINE
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddLineItem}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/40 text-xs font-bold text-[#f5d77f] hover:bg-[#d4af37]/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADD ITEM</span>
          </button>
        </div>

        <div className="space-y-3">
          {lineItems.map((item, idx) => {
            const rowTotal = item.quantity * item.unitPrice;
            return (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-3 items-center p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80"
              >
                <div className="col-span-12 md:col-span-5 space-y-1.5">
                  {products && products.length > 0 && (
                    <select
                      onChange={(e) => handleSelectProduct(item.id, e.target.value)}
                      defaultValue=""
                      className="w-full bg-zinc-900/90 border border-[#d4af37]/40 rounded-lg px-2.5 py-1 text-[11px] font-mono text-[#f5d77f] focus:outline-none focus:border-[#d4af37]"
                    >
                      <option value="" disabled>
                        ⚡ AUTO-FILL FROM CATALOG...
                      </option>
                      {products.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name} • Rp {Number(prod.unit_price).toLocaleString('id-ID')}
                        </option>
                      ))}
                      <option value="custom">-- Custom / Manual Override --</option>
                    </select>
                  )}
                  <BulletTextarea
                    rows={3}
                    required
                    placeholder="Automatic bullet points..."
                    value={item.description}
                    onChange={(val) =>
                      handleUpdateItem(item.id, 'description', val)
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#d4af37] font-sans whitespace-pre-line"
                  />
                </div>

                <div className="col-span-4 md:col-span-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={item.quantity}
                    onChange={(e) =>
                      handleUpdateItem(item.id, 'quantity', Number(e.target.value))
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-center text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div className="col-span-5 md:col-span-3">
                  <RupiahInput
                    required
                    value={item.unitPrice}
                    onChange={(e) =>
                      handleUpdateItem(item.id, 'unitPrice', Number(e.target.value))
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-right text-[#f5d77f] focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div className="col-span-2 md:col-span-1 text-right text-xs font-mono font-bold text-zinc-300">
                  Rp {Math.round(rowTotal).toLocaleString('id-ID')}
                </div>

                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={lineItems.length <= 1}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Grand Total Bottom Strip */}
        <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-xs font-mono uppercase text-zinc-400">
            TOTAL INVOICE AMOUNT
          </span>
          <span className="text-2xl font-black font-mono text-[#f5d77f] drop-shadow-[0_0_12px_rgba(245,215,127,0.4)]">
            Rp {grandTotal.toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      {/* Footer Submission Actions */}
      {/* Footer Submission Actions (Mobile-First responsive flex & touch target height >=44px) */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
        <Link
          href="/invoices"
          className="px-5 py-3 min-h-[44px] rounded-full border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-300 uppercase tracking-wider transition-colors text-center flex items-center justify-center"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="gold-btn inline-flex items-center justify-center gap-2.5 px-8 py-3 min-h-[44px] rounded-full text-xs uppercase tracking-wider disabled:opacity-75 transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)]"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : (
            <Check className="w-4 h-4 text-black" />
          )}
          <span className="font-extrabold">
            {isPending ? 'GENERATING INVOICE...' : 'SAVE & GENERATE INVOICE'}
          </span>
        </button>
      </div>
    </form>
  );
}
