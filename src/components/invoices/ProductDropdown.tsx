'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { CatalogProductOption } from '@/components/invoices/NewInvoiceForm';

interface ProductDropdownProps {
  products: CatalogProductOption[];
  value: string; // The selected product id, or 'custom'
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function ProductDropdown({ products, value, onChange, placeholder = 'Select a product...', className = '' }: ProductDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedProduct = products.find(p => p.id === value);

  // Group products by guessed category
  const groupedProducts = useMemo(() => {
    const groups: Record<string, CatalogProductOption[]> = {
      'Store Management': [],
      'Pabrik Sosmed': [],
      'Advertising & Ads': [],
      'Services & Add-ons': [],
      'Others': []
    };

    const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    filtered.forEach(p => {
      const name = p.name.toLowerCase();
      // Use explicit category if available in the future, otherwise guess
      const cat = (p as any).category;
      if (cat && groups[cat] !== undefined) {
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(p);
      } else if (name.includes('shopee') || name.includes('store') || name.includes('etalase') || name.includes('renewal')) {
        groups['Store Management'].push(p);
      } else if (name.includes('tiktok') || name.includes('reels') || name.includes('sosmed') || name.includes('instagram')) {
        groups['Pabrik Sosmed'].push(p);
      } else if (name.includes('ads') || name.includes('meta') || name.includes('advertising')) {
        groups['Advertising & Ads'].push(p);
      } else if (name.includes('jasa') || name.includes('edit') || name.includes('foto') || name.includes('add on')) {
        groups['Services & Add-ons'].push(p);
      } else {
        groups['Others'].push(p);
      }
    });

    // Remove empty groups
    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [products, search]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-zinc-900/90 border border-[#d4af37]/40 rounded-lg px-2.5 py-2 text-[11px] font-mono text-left focus:outline-none focus:border-[#d4af37] transition-colors"
      >
        <span className={selectedProduct ? 'text-[#f5d77f]' : 'text-zinc-400'}>
          {value === 'custom' ? '-- Custom / Manual --' : selectedProduct ? selectedProduct.name : placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#15161a] border border-[#d4af37]/30 rounded-lg shadow-xl shadow-black/50 overflow-hidden flex flex-col max-h-[350px]">
          <div className="p-2 border-b border-zinc-800/80 shrink-0 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search catalog..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700/50 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#d4af37]/50"
              autoFocus
            />
          </div>
          
          <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => { onChange('custom'); setIsOpen(false); }}
              className="w-full text-left px-3 py-2 text-[11px] font-mono text-zinc-400 hover:bg-zinc-800/50 hover:text-white rounded-md transition-colors"
            >
              -- Custom / Manual --
            </button>
            
            {groupedProducts.map(([category, items]) => (
              <div key={category} className="mt-2 mb-1">
                <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {category}
                </div>
                {items.map(product => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => { onChange(product.id); setIsOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-md transition-colors group ${
                      value === product.id ? 'bg-[#d4af37]/20 text-[#f5d77f]' : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <span className="font-semibold text-left truncate pr-2 group-hover:text-white transition-colors">{product.name}</span>
                    <span className="font-mono text-[10px] text-zinc-400 shrink-0">
                      Rp {Number(product.unit_price).toLocaleString('id-ID')}
                    </span>
                  </button>
                ))}
              </div>
            ))}
            
            {groupedProducts.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-zinc-500">
                No products found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
