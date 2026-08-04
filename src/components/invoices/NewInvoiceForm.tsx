'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2, Check, AlertCircle, Loader2, Calendar, Building2 } from 'lucide-react';
import Link from 'next/link';
import { createInvoice, updateInvoice } from '@/app/actions/invoices';
import { createClientRecord } from '@/app/actions/settings';
import { RupiahInput } from '@/components/ui/RupiahInput';
import { BulletTextarea } from '@/components/ui/BulletTextarea';

// Helper for Indonesian abbreviated months
const formatIndoDateStr = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

function FormattedDateInput({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  return (
    <div className="relative w-full group">
      <div className="absolute inset-0 flex items-center justify-between px-4 bg-zinc-950 border border-zinc-800 rounded-xl pointer-events-none group-focus-within:border-[#d4af37]">
        <span className="text-sm font-bold text-white font-mono">
          {formatIndoDateStr(value) || 'Select Date'}
        </span>
        <Calendar className="w-4 h-4 text-[#d4af37]" />
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[46px] opacity-0 cursor-pointer"
        required
      />
    </div>
  );
}

interface LineItem {
  id: string;
  packageName: string;
  description: string;
  quantity: number;
  scale: string;
  unitPrice: number;
  discountAmount?: number;
}

export interface CatalogProductOption {
  id: string;
  name: string;
  description?: string;
  unit_price: number;
  quantity?: number;
  scale?: string;
}

export interface BankAccountOption {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_default?: boolean;
}

interface NewInvoiceFormProps {
  clients: Array<{ id: string; name: string, company_name?: string }>;
  products?: CatalogProductOption[];
  bankAccounts?: BankAccountOption[];
  isHistorical?: boolean;
  initialData?: any;
  activeWorkspaceId?: string;
  availableWorkspaces?: Array<{ id: string; name: string }>;
}

export function NewInvoiceForm({ clients, products = [], bankAccounts = [], isHistorical = false, initialData, activeWorkspaceId, availableWorkspaces = [] }: NewInvoiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const getNet7Date = (startDate?: string) => {
    const d = startDate ? new Date(startDate) : new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  const [localClients, setLocalClients] = useState(clients);
  const [clientId, setClientId] = useState(initialData?.clientId || (clients.length === 1 ? clients[0].id : ''));
  const searchParams = useSearchParams();
  const [isQuotation, setIsQuotation] = useState(() => initialData ? initialData.isQuotation : searchParams.get('type') === 'quotation');
  
  // Quick Add Client State
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState(() => initialData?.invoiceNumber || (initialData?.isQuotation || (typeof searchParams !== 'undefined' && searchParams.get('type') === 'quotation') ? `QUOTE-2026-${Math.floor(100 + Math.random() * 900)}` : `INV-2026-${Math.floor(100 + Math.random() * 900)}`));
  const [issueDate, setIssueDate] = useState(() => initialData?.issueDate || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => initialData?.dueDate || getNet7Date());
  const [globalDiscount, setGlobalDiscount] = useState<number>(initialData?.discountAmount || 0);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [bankAccountId, setBankAccountId] = useState(initialData?.bankAccountId || (bankAccounts && bankAccounts.length > 0 ? bankAccounts[0].id : 'all'));
  const [customPaymentInstructions, setCustomPaymentInstructions] = useState(initialData?.paymentInstructions || '');
  const [assignedWorkspaceId, setAssignedWorkspaceId] = useState(
    initialData?.assignedWorkspaceId || 
    (activeWorkspaceId && activeWorkspaceId !== '11111111-1111-1111-1111-111111111111' ? activeWorkspaceId : '')
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [lineItems, setLineItems] = useState<LineItem[]>(initialData?.lineItems || []);

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        packageName: '',
        description: '',
        quantity: 1,
        scale: 'pc',
        unitPrice: 0,
        discountAmount: 0,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setLineItems((prev) => prev.filter((i) => i.id !== id));
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
                packageName: prod.name,
                description: prod.description || '',
                unitPrice: Number(prod.unit_price),
                quantity: Number(prod.quantity) || 1,
                scale: prod.scale || 'pc',
                discountAmount: 0,
              }
            : item
        )
      );
    }
  };

  const subTotal = lineItems.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice - (item.discountAmount || 0),
    0
  );

  const grandTotal = Math.max(0, subTotal - globalDiscount);

  const handleQuickAddClient = async () => {
    if (!quickAddName.trim()) return;
    setIsQuickAdding(true);
    try {
      const res = await createClientRecord({
        name: quickAddName,
        contactType: 'client'
      });
      if (res.success && res.client) {
        setLocalClients(prev => [...prev, res.client]);
        setClientId(res.client.id);
        setShowQuickAdd(false);
        setQuickAddName('');
      } else {
        setErrorMsg(res.error || 'Failed to create client');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error creating client');
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleSubmit = (e: React.FormEvent, submitAsQuotation: boolean = false) => {
    e.preventDefault();
    if (lineItems.length === 0) {
      setErrorMsg('Please add at least one deliverable line item before saving.');
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      try {
        if (initialData) {
          const res = await updateInvoice({
            id: initialData.id,
            clientId,
            invoiceNumber,
            issueDate,
            dueDate,
            notes,
            bankAccountId: bankAccountId === 'all' ? undefined : bankAccountId,
            paymentInstructions: customPaymentInstructions,
            discountAmount: globalDiscount,
            lineItems: lineItems.map((l) => ({
              packageName: l.packageName,
              description: l.description,
              quantity: Number(l.quantity),
              scale: l.scale,
              unitPrice: Number(l.unitPrice),
              discountAmount: Number(l.discountAmount) || 0,
            })),
            isQuotation: submitAsQuotation,
            assignedWorkspaceId: assignedWorkspaceId || undefined,
          });
          if (res.success && !res.error) {
            router.push(`/invoices/${res.invoiceId}`);
          } else if (res.success && res.error) {
            setErrorMsg(res.error);
          } else {
            setErrorMsg(res.error || 'Failed to update invoice');
          }
        } else {
          const finalNotes = isHistorical ? `[HISTORICAL_OPENING_BALANCE] ${notes}` : notes;
          const res = await createInvoice({
            clientId,
            invoiceNumber,
            issueDate,
            dueDate,
            notes: finalNotes,
            bankAccountId: bankAccountId !== 'all' ? bankAccountId : undefined,
            paymentInstructions: bankAccountId === 'custom' ? customPaymentInstructions : undefined,
            discountAmount: globalDiscount,
            lineItems: lineItems.map((l) => ({
              packageName: l.packageName,
              description: l.description,
              quantity: Number(l.quantity),
              scale: l.scale,
              unitPrice: Number(l.unitPrice),
              discountAmount: Number(l.discountAmount) || 0,
            })),
            isHistorical,
            isQuotation: submitAsQuotation,
            assignedWorkspaceId: assignedWorkspaceId || undefined,
          });
          if (res.success && !res.error) {
            router.push(`/invoices/${res.invoiceId}`);
          } else if (res.success && res.error) {
            setErrorMsg(res.error);
          } else {
            setErrorMsg(res.error || 'Failed to create invoice. Please verify your workspace permission.');
          }
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'An unexpected error occurred while saving.');
      }
    });
  };

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6 max-w-4xl mx-auto">
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
            <div className="flex gap-2 items-center mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                Select Client <span className="text-red-500">*</span>
              </label>
              <button 
                type="button" 
                onClick={() => setShowQuickAdd(!showQuickAdd)}
                className="text-[10px] uppercase font-bold text-[#d4af37] hover:text-[#f5d77f] px-2 py-0.5 rounded border border-[#d4af37]/30 bg-[#d4af37]/10"
              >
                + Quick Add
              </button>
            </div>
            
            {showQuickAdd && (
              <div className="flex gap-2 mb-3 bg-black/40 p-2 rounded-xl border border-zinc-800">
                <input 
                  type="text"
                  placeholder="Client Name..."
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-[#d4af37] focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={isQuickAdding || !quickAddName.trim()}
                  onClick={handleQuickAddClient}
                  className="bg-[#d4af37] text-black px-3 py-1.5 rounded-lg text-xs font-bold uppercase disabled:opacity-50"
                >
                  {isQuickAdding ? '...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
                >
                  Cancel
                </button>
              </div>
            )}
            
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]"
              required
            >
              <option value="">-- Choose Client Profile --</option>
              {localClients.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company_name && c.company_name !== c.name ? `(${c.company_name})` : ''}
                </option>
              ))}
            </select>
            
            {activeWorkspaceId === '11111111-1111-1111-1111-111111111111' && (
              <div className="mt-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                  <div className="flex items-center gap-1.5 text-orange-400">
                    <Building2 className="w-3.5 h-3.5" />
                    Assign To
                  </div>
                </label>
                <select
                  value={assignedWorkspaceId}
                  onChange={(e) => setAssignedWorkspaceId(e.target.value)}
                  className="w-full bg-zinc-950 border border-orange-500/30 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">No Assignment</option>
                  {availableWorkspaces.filter(w => w.id !== '11111111-1111-1111-1111-111111111111').map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-500 mt-1 font-mono">
                  This invoice and its revenue will reflect on the assigned workspace's dashboard.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              {isQuotation ? 'Quotation Number *' : 'Invoice Reference Number *'}
            </label>
            <input
              type="text"
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-mono text-[#f5d77f] focus:outline-none focus:border-[#d4af37]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              {isQuotation ? 'Date Make' : 'Issue Date'}
            </label>
            <FormattedDateInput 
              value={issueDate}
              onChange={(newDate) => {
                setIssueDate(newDate);
                setDueDate(getNet7Date(newDate));
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              {isQuotation ? 'Date Expired' : 'Due Date (Auto 7-Day Terms)'}
            </label>
            <FormattedDateInput 
              value={dueDate}
              onChange={setDueDate}
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

        {lineItems.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40">
            <p className="text-xs text-zinc-400 font-mono mb-3">
              No deliverable line items added yet. Click &quot;+ ADD ITEM&quot; to begin.
            </p>
            <button
              type="button"
              onClick={handleAddLineItem}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#d4af37]/20 border border-[#d4af37] text-xs font-bold text-[#f5d77f] hover:bg-[#d4af37]/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>ADD FIRST ITEM</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* HEADER ROW */}
            <div className="grid grid-cols-12 gap-3 text-[10px] font-bold text-[#d4af37]/60 tracking-wider mb-2 px-2 hidden md:grid uppercase">
                <div className="col-span-3">Item / Service</div>
                <div className="col-span-3">Description</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Unit Price</div>
                <div className="col-span-2 text-right pr-8">Total</div>
            </div>
            {lineItems.map((item) => {
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 mb-2 relative"
                >
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="absolute top-3 right-3 p-1.5 text-zinc-500 hover:text-red-400 transition-colors bg-zinc-900/50 rounded-lg hover:bg-zinc-800"
                    title="Remove Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-12 gap-3 items-start pr-10">
                    <div className="col-span-12 md:col-span-3 space-y-1.5">
                      {products && products.length > 0 ? (
                        <select
                          value={products.find(p => p.name === item.packageName) ? products.find(p => p.name === item.packageName)?.id : 'custom'}
                          onChange={(e) => {
                            if (e.target.value === 'custom') {
                              handleUpdateItem(item.id, 'packageName', '');
                            } else {
                              handleSelectProduct(item.id, e.target.value);
                            }
                          }}
                          className="w-full bg-zinc-900/90 border border-[#d4af37]/40 rounded-lg px-2.5 py-2 text-[11px] font-mono text-[#f5d77f] focus:outline-none focus:border-[#d4af37]"
                        >
                          <option value="custom">-- Custom / Manual --</option>
                          {products.map((prod) => (
                            <option key={prod.id} value={prod.id}>
                              {prod.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Package Name"
                          value={item.packageName}
                          onChange={(e) => handleUpdateItem(item.id, 'packageName', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-[#d4af37]"
                        />
                      )}
                    </div>
                    
                    <div className="col-span-12 md:col-span-3">
                      <BulletTextarea
                        rows={2}
                        required
                        placeholder="Automatic bullet points..."
                        value={item.description}
                        onChange={(val) =>
                          handleUpdateItem(item.id, 'description', val)
                        }
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-[#d4af37] font-sans whitespace-pre-line leading-snug"
                      />
                    </div>

                    <div className="col-span-12 md:col-span-2 flex flex-col gap-1.5">
                      <div className="md:hidden text-[10px] font-bold text-[#d4af37]/60">QTY & UNIT</div>
                      <div className="flex gap-1">
                          <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(item.id, 'quantity', Math.max(1, Number(e.target.value)))}
                          className="w-14 bg-black/40 border border-[#d4af37]/20 rounded-lg px-2 py-1.5 text-[#f5d77f] focus:outline-none focus:border-[#d4af37]/50 text-xs text-center"
                          />
                          <select
                          value={item.scale || 'pc'}
                          onChange={(e) => handleUpdateItem(item.id, 'scale', e.target.value)}
                          className="flex-1 bg-black/40 border border-[#d4af37]/20 rounded-lg px-1 py-1.5 text-[#f5d77f] focus:outline-none focus:border-[#d4af37]/50 text-xs"
                          >
                          <option value="pc">Pc</option>
                          <option value="hour">Hour</option>
                          <option value="day">Day</option>
                          <option value="month">Month</option>
                          </select>
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-2 flex flex-col gap-1.5">
                      <div className="md:hidden text-[10px] font-bold text-[#d4af37]/60">UNIT PRICE</div>
                      <RupiahInput
                          value={item.unitPrice}
                          onChange={(e: any) => handleUpdateItem(item.id, 'unitPrice', Number(e.target.value) || 0)}
                          placeholder="Price"
                          className="w-full bg-black/40 border border-[#d4af37]/20 rounded-lg px-2.5 py-1.5 text-[#f5d77f] focus:outline-none focus:border-[#d4af37]/50 text-xs"
                      />
                    </div>

                    <div className="col-span-12 md:col-span-2 flex flex-col items-end justify-start">
                      <div className="md:hidden text-[10px] font-bold text-[#d4af37]/60 w-full text-left mb-1">BASE TOTAL</div>
                      <div className="text-xs font-mono text-zinc-400 mt-1 md:mt-2">
                          Rp {(item.quantity * item.unitPrice).toLocaleString('en-US')}
                      </div>
                    </div>
                  </div>

                  {/* Discount Row */}
                  <div className="flex justify-end items-center gap-3 pt-2 mt-1 border-t border-zinc-800/50 pr-10">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Discount</span>
                    <div className="w-28 md:w-32">
                      <RupiahInput
                          value={item.discountAmount || 0}
                          onChange={(e: any) => handleUpdateItem(item.id, 'discountAmount', Number(e.target.value) || 0)}
                          placeholder="Discount"
                          className="w-full text-right bg-black/40 border border-[#d4af37]/20 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-[#d4af37]/50 text-xs"
                      />
                    </div>
                    <div className="w-28 text-right text-sm font-bold text-[#f5d77f]">
                        Rp {(item.quantity * item.unitPrice - (item.discountAmount || 0)).toLocaleString('en-US')}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* SUMMARY */}
            {!isQuotation && (
              <div className="flex flex-col items-end pt-4 border-t border-[#d4af37]/20 gap-3">
                <div className="flex justify-between w-full md:w-1/3 items-center">
                <span className="text-sm text-[#d4af37]/60">Subtotal:</span>
                <span className="font-mono text-[#f5d77f]">Rp {subTotal.toLocaleString('en-US')}</span>
                </div>
                <div className="flex justify-between w-full md:w-1/3 items-center">
                <span className="text-sm text-red-400/80">Invoice Discount:</span>
                <RupiahInput
                    value={globalDiscount}
                    onChange={(e: any) => setGlobalDiscount(Number(e.target.value) || 0)}
                    className="w-32 bg-black/40 border border-red-500/30 rounded-lg px-2 py-1 text-red-400 text-right font-mono text-sm focus:outline-none focus:border-red-500/60"
                />
                </div>
                <div className="flex justify-between w-full md:w-1/3 items-center pt-3 border-t border-[#d4af37]/20">
                <span className="text-lg font-bold text-[#d4af37]">Grand Total:</span>
                <span className="text-xl font-mono font-bold text-white">Rp {grandTotal.toLocaleString('en-US')}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!isQuotation && (
        <div className="gold-glass-panel rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 border-b border-zinc-800 pb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#d4af37]" />
            <span>PAYMENT & BANK DISBURSEMENT INSTRUCTIONS</span>
          </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Bank Payment Account Option
            </label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-[#f5d77f] focus:outline-none focus:border-[#d4af37] font-sans"
            >
              {bankAccounts?.map((b) => {
                const cleanName = b.bank_name
                  .replace(/Primary Bank Account - /gi, '')
                  .replace(/Secondary Bank \(\d+\) - /gi, '')
                  .replace(/Primary Bank Account/gi, '')
                  .replace(/Secondary Bank \(\d+\)/gi, '')
                  .replace(/Secondary Bank Account/gi, '')
                  .trim();
                
                const label = cleanName 
                  ? `${cleanName} | ${b.account_number} | ${b.account_name}`
                  : `${b.account_number} | ${b.account_name}`;
                  
                return (
                  <option key={b.id} value={b.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {bankAccountId === 'custom' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#f5d77f] mb-2">
                Custom Payment Instructions
              </label>
              <textarea
                rows={2}
                value={customPaymentInstructions}
                onChange={(e) => setCustomPaymentInstructions(e.target.value)}
                placeholder="Enter exact bank account details or transfer notes to show on this invoice..."
                className="w-full bg-zinc-950 border border-[#d4af37]/60 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37] font-mono"
              />
            </div>
          )}

          <div className={bankAccountId === 'custom' ? 'md:col-span-2' : ''}>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              Additional Notes & Terms (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special notes or contractual terms displayed at the bottom of the invoice..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37] font-sans"
            />
          </div>
        </div>
        </div>
      </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
        <Link
          href="/invoices"
          className="px-5 py-3 min-h-[44px] rounded-full border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-300 uppercase tracking-wider transition-colors text-center flex items-center justify-center"
        >
          Cancel
        </Link>
        <button
          type="button"
          disabled={isPending || !clientId}
          onClick={(e) => handleSubmit(e, isQuotation)}
          className="gold-btn inline-flex items-center justify-center gap-2.5 px-8 py-3 min-h-[44px] rounded-full text-xs uppercase tracking-wider disabled:opacity-75 transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)]"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : (
            <Check className="w-4 h-4 text-black" />
          )}
          <span className="font-extrabold">
            {isPending ? 'GENERATING...' : isQuotation ? (initialData ? 'UPDATE QUOTATION' : 'SAVE QUOTATION') : (initialData ? 'UPDATE INVOICE' : 'SAVE INVOICE')}
          </span>
        </button>
      </div>
    </form>
  );
}
