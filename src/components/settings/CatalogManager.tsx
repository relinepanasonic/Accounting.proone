'use client';

import React, { useState, useTransition } from 'react';
import { Plus, Trash2, Package, Loader2, AlertCircle } from 'lucide-react';
import { createProduct, deleteProduct } from '@/app/actions/settings';
import { RupiahInput } from '@/components/ui/RupiahInput';
import { DescriptionBullets } from '@/components/ui/DescriptionBullets';

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

        <div className="space-y-3">
          <div>
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

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              DELIVERABLE DESCRIPTION (BULLET POINTS)
            </label>
            <textarea
              rows={3}
              placeholder={`Enter bullet points (one per line or pipe-separated):\n• 3 month Contracts\n• 2 jam per live session\n• Regular Host ketersediaan Jam Host`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37] font-sans whitespace-pre-line"
            />
          </div>

          <div>
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
              {products.map((item) => (
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
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-500/50 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
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
