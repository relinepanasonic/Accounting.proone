'use client';

import React, { useState, useTransition } from 'react';
import { Plus, Trash2, Package, Loader2, AlertCircle, Edit2, Copy, X, Check } from 'lucide-react';
import { createProduct, deleteProduct, updateProduct, duplicateProduct } from '@/app/actions/settings';
import { RupiahInput } from '@/components/ui/RupiahInput';
import { DescriptionBullets } from '@/components/ui/DescriptionBullets';
import { BulletTextarea } from '@/components/ui/BulletTextarea';

export interface CatalogProduct {
  id: string;
  name: string;
  description?: string;
  unit_price: number;
}

interface CatalogManagerProps {
  targetWorkspaceId?: string;
  initialProducts: CatalogProduct[];
}

export function CatalogManager({ targetWorkspaceId, initialProducts }: CatalogManagerProps) {
  const [products, setProducts] = useState<CatalogProduct[]>(initialProducts);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('85000000');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('0');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await createProduct({
          targetWorkspaceId,
          name,
          description,
          unitPrice: Number(unitPrice) || 0,
        });

        if (!res.success) {
          setErrorMsg(res.error || 'Failed to create product');
        } else {
          setProducts((prev) => [
            {
              id: Math.random().toString(),
              name,
              description,
              unit_price: Number(unitPrice) || 0,
            },
            ...prev,
          ]);
          setName('');
          setDescription('');
          setUnitPrice('1000000');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Error saving item');
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      await deleteProduct(id, targetWorkspaceId);
    });
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return;
    startTransition(async () => {
      const res = await updateProduct({
        id,
        targetWorkspaceId,
        name: editName.trim(),
        description: editDesc,
        unitPrice: Number(editPrice) || 0,
      });
      if (res.success) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, name: editName.trim(), description: editDesc, unit_price: Number(editPrice) || 0 }
              : p
          )
        );
        setEditingId(null);
      } else {
        setErrorMsg(res.error || 'Failed to update item');
      }
    });
  };

  const handleDuplicate = (id: string) => {
    startTransition(async () => {
      const res = await duplicateProduct(id, targetWorkspaceId);
      if (res.success && res.product) {
        setProducts((prev) => [res.product, ...prev]);
      } else if (!res.success) {
        setErrorMsg(res.error || 'Failed to duplicate item');
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Quick Add Product Form */}
      <form
        onSubmit={handleAddProduct}
        className="gold-glass-panel rounded-3xl p-6 space-y-4 lg:col-span-1 h-fit"
      >
        <div className="border-b border-[#d4af37]/20 pb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-[#d4af37]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            ADD CATALOG SERVICE
          </h3>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/60 text-[#f5d77f] text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              SERVICE / ITEM NAME *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. TikTok Live Production Retainer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div className="md:col-span-6">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              DELIVERABLE DESCRIPTION (BULLET POINTS)
            </label>
            <BulletTextarea
              rows={3}
              placeholder="Automatic bullet points..."
              value={description}
              onChange={(val) => setDescription(val)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37] font-sans whitespace-pre-line"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              UNIT PRICE (IDR / RP) *
            </label>
            <RupiahInput
              required
              placeholder="Rp 0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-[#f5d77f] focus:outline-none focus:border-[#d4af37]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="gold-btn w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : (
            <Plus className="w-4 h-4 text-black" />
          )}
          <span>SAVE TO CATALOG</span>
        </button>
      </form>

      {/* Catalog Table */}
      <div className="gold-glass-panel rounded-3xl p-6 lg:col-span-2 space-y-4">
        <div className="border-b border-[#d4af37]/20 pb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            STANDARDIZED SERVICE CATALOG ({products.length} ITEMS)
          </h3>
          <span className="text-[10px] font-mono text-[#f5d77f]">AVAILABLE FOR INSTANT INVOICING</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="py-3 px-3">SERVICE NAME & DESCRIPTION</th>
                <th className="py-3 px-3 text-right">UNIT PRICE (RP)</th>
                <th className="py-3 px-3 text-right w-16">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-xs">
              {products.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id} className="bg-zinc-900/60 border-y border-[#d4af37]/40 transition-colors">
                    <td className="py-3 px-3 min-w-[240px]">
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                            SERVICE NAME *
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoFocus
                            className="w-full bg-black border border-yellow-600/40 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                            DELIVERABLE DESCRIPTION (BULLET POINTS)
                          </label>
                          <BulletTextarea
                            rows={3}
                            value={editDesc}
                            onChange={(val) => setEditDesc(val)}
                            className="w-full bg-black border border-yellow-600/40 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37] whitespace-pre-line font-sans"
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right align-top">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-300 mb-1 text-right">
                          UNIT PRICE (RP) *
                        </label>
                        <RupiahInput
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-40 bg-black border border-yellow-600/40 rounded-xl px-2.5 py-1.5 text-xs font-mono text-[#f5d77f] text-right focus:outline-none focus:border-[#d4af37] ml-auto"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right align-top whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 mt-4">
                        <button
                          onClick={() => handleUpdate(item.id)}
                          disabled={isPending || !editName.trim()}
                          className="p-1.5 rounded-lg bg-green-500/15 border border-green-500/40 hover:border-green-400 text-green-400 transition-colors"
                          title="Save Changes"
                        >
                          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-white">{item.name}</div>
                      <DescriptionBullets
                        description={item.description}
                        allBullets={true}
                        isDark={true}
                        className="mt-1"
                      />
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-[#f5d77f]">
                      Rp {Number(item.unit_price).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDuplicate(item.id)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-[#f5d77f]/50 text-zinc-500 hover:text-[#f5d77f] transition-colors"
                          title="Duplicate Product"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(item.id);
                            setEditName(item.name);
                            setEditDesc(item.description || '');
                            setEditPrice(String(item.unit_price || 0));
                          }}
                          disabled={isPending}
                          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-[#f5d77f]/50 text-zinc-500 hover:text-[#f5d77f] transition-colors"
                          title="Edit Product"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-500/50 text-zinc-500 hover:text-red-400 transition-colors"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
              {products.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-xs text-zinc-500 font-mono">
                    No catalog items configured yet. Use the form to add standardized services.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
