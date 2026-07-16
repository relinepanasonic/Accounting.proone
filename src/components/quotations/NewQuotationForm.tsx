'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Check, AlertCircle, Loader2, Package, Sparkles } from 'lucide-react';
import { createQuotation } from '@/app/actions/quotations';
import { RupiahInput } from '@/components/ui/RupiahInput';
import { BulletTextarea } from '@/components/ui/BulletTextarea';
import type { CatalogProductOption } from '@/components/invoices/NewInvoiceForm';

interface QuotationItem {
  id: string;
  description: string;
  unitPrice: number;
}

interface NewQuotationFormProps {
  clients: Array<{ id: string; name: string }>;
  products?: CatalogProductOption[];
}

export function NewQuotationForm({ clients, products = [] }: NewQuotationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const getNext30DaysDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };

  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [quotationNumber, setQuotationNumber] = useState('QUO-2026-001');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(getNext30DaysDate);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [lineItems, setLineItems] = useState<QuotationItem[]>([
    {
      id: '1',
      description: '• TikTok & Reels Short-Form Video Package (15 Creative Deliverables)\n• Concept, Scripting, Filming & Professional Post-Production\n• 2 Rounds of Revisions per Deliverable',
      unitPrice: 35000000,
    },
    {
      id: '2',
      description: '• Executive E-Commerce Account Strategy & Live Stream Management\n• Dedicated Host & Technical Production Setup\n• Real-time Sales Analytics Optimization',
      unitPrice: 48000000,
    },
  ]);

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        description: '',
        unitPrice: 0,
      },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      setErrorMsg('At least one deliverable pitch item is required.');
      return;
    }
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof QuotationItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleAddFromCatalog = (prod: CatalogProductOption) => {
    setLineItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        description: prod.description ? `• ${prod.name}\n${prod.description}` : `• ${prod.name}`,
        unitPrice: Number(prod.unit_price) || 0,
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setErrorMsg('Please select a prospective client or payee.');
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await createQuotation({
          clientId,
          quotationNumber,
          issueDate,
          validUntil,
          notes,
          lineItems: lineItems.map((l) => ({
            description: l.description,
            unitPrice: Number(l.unitPrice) || 0,
          })),
        });

        if (!res.success) {
          setErrorMsg(res.error || 'Failed to create quotation.');
          return;
        }

        if (res.quotationId) {
          router.push(`/quotations/${res.quotationId}`);
        } else {
          router.push('/quotations');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'An unexpected error occurred while generating quotation.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto">
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/60 text-[#f5d77f] text-xs font-mono shadow-[0_0_20px_rgba(212,175,55,0.25)]">
          <AlertCircle className="w-5 h-5 shrink-0 text-[#f5d77f]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* METADATA PANEL */}
      <div className="gold-glass-panel rounded-2xl p-6 space-y-6">
        <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#f5d77f] flex items-center gap-2 font-mono">
            <span>PROSPECTIVE CLIENT & PITCH PARAMETERS</span>
          </h2>
          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-full border border-zinc-800">
            NO TOTALS CALCULATED (PITCH MENU)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5 font-sans">
              PROSPECTIVE CLIENT / PAYEE *
            </label>
            <select
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isPending}
              className="w-full bg-black/80 border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs text-white font-sans focus:outline-none focus:border-[#d4af37] transition-all"
            >
              {clients.length === 0 && <option value="">No clients available - create one first</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5 font-mono">
              QUOTATION REF NO *
            </label>
            <input
              type="text"
              required
              value={quotationNumber}
              onChange={(e) => setQuotationNumber(e.target.value)}
              disabled={isPending}
              className="w-full bg-black/80 border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#d4af37] transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5 font-mono">
              VALID UNTIL *
            </label>
            <input
              type="date"
              required
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              disabled={isPending}
              className="w-full bg-black/80 border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#d4af37] transition-all"
            />
          </div>
        </div>
      </div>

      {/* QUICK CATALOG SELECTOR (CHOOSE WHICH PRODUCTS TO QUOTE) */}
      {products.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#12141a] to-[#1a1e29] border border-[#d4af37]/30 space-y-4">
          <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#d4af37]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#f5d77f] font-mono">
                CHOOSE PRODUCTS / SERVICES FROM CATALOG TO PITCH
              </h3>
            </div>
            <span className="text-[10px] text-zinc-400 font-sans">Click any item below to add to quotation</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
            {products.map((p) => (
              <div
                key={p.id}
                onClick={() => handleAddFromCatalog(p)}
                className="p-3 rounded-xl bg-black/60 border border-zinc-800 hover:border-[#d4af37] transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-bold text-white group-hover:text-[#f5d77f] truncate font-sans">
                    {p.name}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    Rp {Number(p.unit_price || 0).toLocaleString('id-ID')} / unit
                  </div>
                </div>
                <button
                  type="button"
                  className="w-7 h-7 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center text-[#f5d77f] group-hover:bg-[#d4af37] group-hover:text-black transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DELIVERABLE PITCH LIST (MENU ITEMS WITHOUT QUANTITY OR TOTAL) */}
      <div className="gold-glass-panel rounded-2xl p-6 space-y-6">
        <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#f5d77f] font-mono">
              PITCH DELIVERABLES & INVESTMENT RATES
            </h3>
            <p className="text-[11px] text-zinc-400 font-sans mt-0.5">
              Enter each deliverable description. Bullet points are formatted automatically when you press Enter or type dashes.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddLineItem}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#f5d77f] hover:bg-[#d4af37]/25 text-xs font-bold font-mono transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> ADD PITCH ITEM
          </button>
        </div>

        <div className="space-y-4">
          {lineItems.map((item, idx) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-black/60 border border-zinc-800/80 space-y-3 relative group hover:border-[#d4af37]/40 transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                <span className="font-bold text-[#f5d77f]">PITCH DELIVERABLE #{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveLineItem(item.id)}
                  className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                  title="Remove Pitch Item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                <div className="md:col-span-3">
                  <label className="block text-[10px] uppercase text-zinc-400 font-mono mb-1">
                    DELIVERABLE SCOPE & BULLET POINTS *
                  </label>
                  <BulletTextarea
                    required
                    rows={4}
                    value={item.description}
                    onChange={(val) => handleItemChange(item.id, 'description', val)}
                    disabled={isPending}
                    placeholder="• Scope detail 1&#10;• Scope detail 2"
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-zinc-400 font-mono mb-1">
                    INVESTMENT RATE (IDR) *
                  </label>
                  <RupiahInput
                    required
                    value={item.unitPrice}
                    onChange={(e: any) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                    disabled={isPending}
                    className="text-xs py-2.5 font-mono font-bold text-[#f5d77f]"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                    Rate per package/unit. No grand total is computed.
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SUBMIT SECTION */}
      <div className="gold-glass-panel rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold text-white uppercase font-sans">READY TO PRESENT PITCH?</h4>
          <p className="text-xs text-zinc-400 font-sans mt-0.5">
            Generates high-end proposal document with brand identity and itemized menu.
          </p>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="gold-btn inline-flex items-center justify-center gap-2.5 px-10 py-4 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_30px_rgba(212,175,55,0.4)] disabled:opacity-50 transition-transform hover:scale-105 min-w-[240px]"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>GENERATING PROPOSAL...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4 text-black" />
              <span>GENERATE PITCH QUOTATION</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
