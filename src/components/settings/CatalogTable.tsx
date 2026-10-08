'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { Check, Copy, Loader2, Package, Plus, Trash2, X } from 'lucide-react';
import { createProduct, deleteProduct, duplicateProduct, updateProduct } from '@/app/actions/settings';
import type { CatalogProduct } from '@/components/settings/CatalogManager';

type DurType = 'none' | 'day' | 'month' | 'deliverable';

const cell = 'w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs text-zinc-100 hover:border-zinc-700 focus:border-[#d4af37]/60 focus:bg-zinc-900 focus:outline-none disabled:opacity-60';
const box = 'rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-[#d4af37]/60 focus:outline-none disabled:opacity-60';
const rp = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

interface Row extends CatalogProduct { _new?: boolean }

/** The product catalog as ONE table. Every cell is editable (saved when you leave it); Length is a drop-down. */
export function CatalogTable({ initialProducts, canEdit }: { initialProducts: CatalogProduct[]; canEdit: boolean }) {
  const [rows, setRows] = useState<Row[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [descOpen, setDescOpen] = useState<string | null>(null);
  const [, start] = useTransition();

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r._new || r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const patchLocal = (id: string, patch: Partial<Row>) => setRows((l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  /** Saves one existing product (the whole row). */
  const save = (row: Row) => {
    if (!canEdit || row._new) return;
    if (!row.name.trim()) { setError('A product needs a name.'); return; }
    setError('');
    setBusy(row.id);
    start(async () => {
      const res = await updateProduct({
        id: row.id, name: row.name.trim(), description: row.description || '', unitPrice: Number(row.unit_price) || 0,
        quantity: Number(row.quantity) || 1, scale: row.scale || 'pc',
        durationType: (row.duration_type || 'none') as DurType, durationValue: Number(row.duration_value) || 0, deliverableUnit: row.deliverable_unit || 'video',
      });
      if (!res.success) setError(res.error || 'Could not save.');
      setBusy(null);
    });
  };

  /** Length drop-down: type change saves at once; the number and unit save when you leave them. */
  const changeType = (row: Row, type: DurType) => {
    const next: Row = { ...row, duration_type: type, duration_value: type === 'none' ? 0 : row.duration_value && Number(row.duration_value) > 0 ? row.duration_value : 1, deliverable_unit: type === 'deliverable' ? row.deliverable_unit || 'video' : null };
    if (row._new) setRows((l) => l.map((r) => (r.id === row.id ? next : r)));
    else { patchLocal(row.id, next); save(next); }
  };

  const addRow = () => {
    if (rows.some((r) => r._new)) return;
    setRows((l) => [{ id: `new-${Date.now()}`, name: '', description: '', unit_price: 0, quantity: 1, scale: 'pc', duration_type: 'none', duration_value: 0, deliverable_unit: null, _new: true }, ...l]);
  };

  const saveNew = (row: Row) => {
    if (!row.name.trim()) { setError('Write the product name first.'); return; }
    setError('');
    setBusy(row.id);
    start(async () => {
      const res: any = await createProduct({
        name: row.name.trim(), description: row.description || '', unitPrice: Number(row.unit_price) || 0, quantity: Number(row.quantity) || 1, scale: row.scale || 'pc',
        durationType: (row.duration_type || 'none') as DurType, durationValue: Number(row.duration_value) || 0, deliverableUnit: row.deliverable_unit || 'video',
      });
      if (res.success && res.product) setRows((l) => l.map((r) => (r.id === row.id ? { ...res.product } : r)));
      else setError(res.error || 'Could not add the product.');
      setBusy(null);
    });
  };

  const remove = (row: Row) => {
    if (row._new) { setRows((l) => l.filter((r) => r.id !== row.id)); return; }
    if (!window.confirm(`Delete "${row.name}" from the catalog? Old invoices keep their lines.`)) return;
    setBusy(row.id);
    start(async () => {
      const res = await deleteProduct(row.id);
      if (res.success) setRows((l) => l.filter((r) => r.id !== row.id));
      else setError(res.error || 'Could not delete.');
      setBusy(null);
    });
  };

  const copy = (row: Row) => {
    setBusy(row.id);
    start(async () => {
      const res: any = await duplicateProduct(row.id);
      if (res.success && res.product) setRows((l) => [res.product, ...l]);
      else setError(res.error || 'Could not duplicate.');
      setBusy(null);
    });
  };

  const LengthCell = ({ row }: { row: Row }) => {
    const type = (row.duration_type || 'none') as DurType;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={type} disabled={!canEdit} onChange={(e) => changeType(row, e.target.value as DurType)} className={box}>
          <option value="none">No length</option>
          <option value="day">Days</option>
          <option value="month">Months</option>
          <option value="deliverable">Videos / photos</option>
        </select>
        {type !== 'none' && (
          <input
            type="number" min={1} disabled={!canEdit} value={row.duration_value ?? ''} aria-label="Length"
            onChange={(e) => patchLocal(row.id, { duration_value: Number(e.target.value) })}
            onBlur={() => save(row)}
            className={`${box} w-16 text-center`}
          />
        )}
        {type === 'deliverable' && (
          <input
            value={row.deliverable_unit || ''} disabled={!canEdit} placeholder="video" aria-label="Unit"
            onChange={(e) => patchLocal(row.id, { deliverable_unit: e.target.value })}
            onBlur={() => save(row)}
            className={`${box} w-20`}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wider text-white"><Package className="h-5 w-5 text-[#d4af37]" /> Product Catalog</h1>
          <span className="text-xs text-zinc-500">{rows.filter((r) => !r._new).length} products</span>
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product" className={`${box} w-56`} />
          {canEdit && (
            <button onClick={addRow} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f5d77f] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:opacity-90">
              <Plus className="h-4 w-4" /> Add new product
            </button>
          )}
        </div>
      </div>
      {!canEdit && <p className="text-[11px] text-zinc-500">You can look at the catalog but not change it.</p>}
      {error && <p className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}<button onClick={() => setError('')} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button></p>}

      <div className="overflow-x-auto rounded-xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
        <table className="w-full min-w-[980px] text-left">
          <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[11px] uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="px-3 py-3 font-bold">Product</th>
              <th className="px-3 py-3 font-bold">Description</th>
              <th className="px-3 py-3 font-bold text-right">Price</th>
              <th className="px-3 py-3 font-bold">Qty</th>
              <th className="px-3 py-3 font-bold">Unit</th>
              <th className="px-3 py-3 font-bold">Length</th>
              {canEdit && <th className="px-3 py-3 font-bold text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {shown.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-sm text-zinc-500">No products. {canEdit ? 'Press "Add new product".' : ''}</td></tr>}
            {shown.map((row) => (
              <tr key={row.id} className={row._new ? 'bg-[#d4af37]/[0.06]' : 'hover:bg-zinc-900/30'}>
                <td className="px-2 py-2 align-top w-[22%]">
                  <input className={`${cell} font-semibold`} value={row.name} disabled={!canEdit} placeholder="Product name" onChange={(e) => patchLocal(row.id, { name: e.target.value })} onBlur={() => save(row)} />
                </td>
                <td className="px-2 py-2 align-top w-[26%]">
                  {descOpen === row.id || row._new ? (
                    <textarea
                      className={`${cell} min-h-[70px]`} rows={3} value={row.description || ''} disabled={!canEdit} placeholder="One line per bullet"
                      onChange={(e) => patchLocal(row.id, { description: e.target.value })}
                      onBlur={() => { setDescOpen(null); save(row); }}
                      autoFocus={!row._new}
                    />
                  ) : (
                    <button type="button" disabled={!canEdit} onClick={() => setDescOpen(row.id)} className="w-full rounded-md px-2 py-1.5 text-left text-[11px] leading-snug text-zinc-400 hover:bg-zinc-900 disabled:hover:bg-transparent">
                      {row.description ? <span className="line-clamp-3 whitespace-pre-line">{row.description}</span> : <span className="text-zinc-600">{canEdit ? 'Add description' : '-'}</span>}
                    </button>
                  )}
                </td>
                <td className="px-2 py-2 align-top w-[12%]">
                  <input
                    className={`${cell} text-right font-mono`} inputMode="numeric" disabled={!canEdit}
                    value={row.unit_price ? String(row.unit_price) : ''} placeholder="0" title={rp(Number(row.unit_price))}
                    onChange={(e) => patchLocal(row.id, { unit_price: Number(e.target.value.replace(/[^\d]/g, '')) })}
                    onBlur={() => save(row)}
                  />
                  <div className="px-2 text-right text-[10px] text-zinc-600">{rp(Number(row.unit_price))}</div>
                </td>
                <td className="px-2 py-2 align-top w-[6%]">
                  <input className={`${cell} text-center`} type="number" min={1} disabled={!canEdit} value={row.quantity ?? 1} onChange={(e) => patchLocal(row.id, { quantity: Number(e.target.value) })} onBlur={() => save(row)} />
                </td>
                <td className="px-2 py-2 align-top w-[7%]">
                  <input className={cell} disabled={!canEdit} value={row.scale || ''} placeholder="pc" onChange={(e) => patchLocal(row.id, { scale: e.target.value })} onBlur={() => save(row)} />
                </td>
                <td className="px-2 py-2 align-top"><LengthCell row={row} /></td>
                {canEdit && (
                  <td className="px-2 py-2 align-top text-right whitespace-nowrap">
                    {busy === row.id ? <Loader2 className="ml-auto h-4 w-4 animate-spin text-zinc-500" /> : row._new ? (
                      <span className="inline-flex gap-1">
                        <button onClick={() => saveNew(row)} className="inline-flex items-center gap-1 rounded-md bg-[#d4af37] px-2.5 py-1.5 text-[11px] font-bold text-black"><Check className="h-3.5 w-3.5" /> Save</button>
                        <button onClick={() => remove(row)} className="rounded-md border border-zinc-700 p-1.5 text-zinc-400 hover:text-white" aria-label="Cancel"><X className="h-3.5 w-3.5" /></button>
                      </span>
                    ) : (
                      <span className="inline-flex gap-1">
                        <button onClick={() => copy(row)} className="rounded-md border border-zinc-800 p-1.5 text-zinc-500 hover:text-white" aria-label="Duplicate" title="Duplicate"><Copy className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(row)} className="rounded-md border border-zinc-800 p-1.5 text-zinc-500 hover:text-red-400" aria-label="Delete" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
