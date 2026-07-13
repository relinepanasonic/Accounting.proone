'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { createInvoice } from '@/app/actions/invoices';

interface ClientOption {
  id: string;
  name: string;
}

interface NewInvoiceFormProps {
  clients: ClientOption[];
}

export function NewInvoiceForm({ clients }: NewInvoiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Smart Defaults: Today and Net 15
  const todayStr = new Date().toISOString().split('T')[0];
  const net15Date = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  const net15Str = net15Date.toISOString().split('T')[0];
  const randomNum = `INV-2026-${Math.floor(100 + Math.random() * 900)}`;

  const [clientId, setClientId] = useState<string>(clients[0]?.id || '');
  const [invoiceNumber, setInvoiceNumber] = useState<string>(randomNum);
  const [issueDate, setIssueDate] = useState<string>(todayStr);
  const [dueDate, setDueDate] = useState<string>(net15Str);
  const [notes, setNotes] = useState<string>('Payment terms: Net 15 via wire transfer or Supabase checkout link.');

  const [lineItems, setLineItems] = useState<
    Array<{ description: string; quantity: number; unitPrice: number }>
  >([
    { description: 'TikTok Shop Live Production Retainer', quantity: 1, unitPrice: 3500 },
  ]);

  // Instant Client-Side Grand Total Calculation (Zero Database Trip)
  const grandTotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  );

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 1000 }]);
  };

  const removeLineItem = (idx: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const updateLineItem = (idx: number, field: string, val: string | number) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: val };
    setLineItems(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!clientId) {
      setErrorMsg('Please select a client.');
      return;
    }

    startTransition(async () => {
      try {
        await createInvoice({
          clientId,
          invoiceNumber,
          issueDate,
          dueDate,
          notes,
          lineItems: lineItems.filter((item) => item.description.trim() !== ''),
        });
        router.push('/invoices');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to generate invoice.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40 flex items-center gap-3 text-red-300 text-xs font-mono">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TOP CONFIGURATION CARD */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        {/* Client Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400 font-mono uppercase text-[10px]">
            1. Client
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-sans focus:outline-none focus:border-cyan-500 transition-colors"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Invoice Number */}
        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400 font-mono uppercase text-[10px]">
            2. Invoice ID #
          </label>
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Issue Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400 font-mono uppercase text-[10px]">
            3. Issue Date
          </label>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Due Date (Net 15 Smart Default) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-amber-400 font-mono uppercase text-[10px] flex items-center gap-1">
            4. Due Date (Smart Net 15)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-mono focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </div>

      {/* LINE ITEMS MODULAR PANEL */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              ACTION SERVICES & LINE ITEMS
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              AUTO-CALCULATES REALTIME SUB-TOTALS
            </p>
          </div>

          <button
            type="button"
            onClick={addLineItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-mono transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            ADD ITEM
          </button>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-3 text-[10px] font-mono text-slate-400 uppercase">
          <span className="col-span-6">Description (Service / Deliverable)</span>
          <span className="col-span-2 text-right">Qty</span>
          <span className="col-span-2 text-right">Unit Rate ($)</span>
          <span className="col-span-2 text-right">Line Total</span>
        </div>

        {/* Line Items List */}
        <div className="space-y-3">
          {lineItems.map((item, idx) => {
            const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
            return (
              <div
                key={idx}
                className="grid grid-cols-12 gap-3 items-center p-2 rounded-xl bg-slate-950/60 border border-slate-800/60"
              >
                {/* Description */}
                <div className="col-span-6">
                  <input
                    type="text"
                    required
                    placeholder="e.g. 30 TikTok UGC Videos or Live-stream Production"
                    value={item.description}
                    onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-sans focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Qty */}
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    value={item.quantity}
                    onChange={(e) => updateLineItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono text-right focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Unit Price */}
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono text-right focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Line Total + Remove */}
                <div className="col-span-2 flex items-center justify-end gap-2 font-mono text-xs font-bold text-cyan-400">
                  <span>${lineTotal.toLocaleString()}</span>
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(idx)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER TOTAL & CYBER-CYAN SUBMISSION BUTTON */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <span className="text-[10px] font-mono uppercase text-slate-400 block">
            INSTANT GRAND TOTAL
          </span>
          <span className="text-3xl font-black text-white tracking-tight drop-shadow-[0_0_12px_rgba(34,211,238,0.4)] font-mono">
            ${grandTotal.toLocaleString()}
          </span>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="px-8 py-4 rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300 hover:from-cyan-300 hover:to-cyan-200 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(34,211,238,0.6)] transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2.5 disabled:opacity-50"
        >
          {isPending ? (
            <span>GENERATING INVOICE...</span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>SAVE & GENERATE INVOICE</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
