'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { createInvoice } from '@/app/actions/invoices';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface NewInvoiceFormProps {
  clients: Array<{ id: string; name: string }>;
}

export function NewInvoiceForm({ clients }: NewInvoiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const getNet15Date = () => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  };

  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [invoiceNumber, setInvoiceNumber] = useState('INV-2026-004');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(getNet15Date);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: '1',
      description: 'TikTok Live Commerce Monthly Production Retainer',
      quantity: 1,
      unitPrice: 85000,
    },
    {
      id: '2',
      description: 'Custom HD Video Creator Package (40 Ads)',
      quantity: 40,
      unitPrice: 1621.75,
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
        await createInvoice({
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
        router.push('/invoices');
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to create invoice');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      {errorMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
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
                <div className="col-span-12 md:col-span-5">
                  <input
                    type="text"
                    required
                    placeholder="Deliverable description..."
                    value={item.description}
                    onChange={(e) =>
                      handleUpdateItem(item.id, 'description', e.target.value)
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
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
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={item.unitPrice}
                    onChange={(e) =>
                      handleUpdateItem(item.id, 'unitPrice', Number(e.target.value))
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-right text-[#f5d77f] focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div className="col-span-2 md:col-span-1 text-right text-xs font-mono font-bold text-zinc-300">
                  ${Math.round(rowTotal).toLocaleString()}
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
            ${grandTotal.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Footer Submission Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/invoices"
          className="px-5 py-2.5 rounded-full border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-300 uppercase tracking-wider transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="gold-btn inline-flex items-center gap-2 px-8 py-3 rounded-full text-xs uppercase tracking-wider disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          <span>
            {isPending ? 'GENERATING INVOICE...' : 'SAVE & GENERATE INVOICE'}
          </span>
        </button>
      </div>
    </form>
  );
}
