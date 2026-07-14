import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { NewInvoiceForm } from '@/components/invoices/NewInvoiceForm';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const { data: clients } = await supabase.from('clients').select('id, name');
  const { data: products } = await supabase.from('products').select('*');

  const clientList =
    clients && clients.length > 0
      ? clients
      : [
          { id: '22222222-2222-2222-2222-222222222201', name: 'Prof Toko Online' },
          { id: '22222222-2222-2222-2222-222222222202', name: 'Nüman Kitchenware' },
          { id: '22222222-2222-2222-2222-222222222203', name: 'Bochtmon Studio' },
        ];

  const productList =
    products && products.length > 0
      ? products
      : [
          {
            id: 'prod-seed-1',
            name: 'TikTok Live Commerce Monthly Production Retainer',
            description: 'Monthly dedicated TikTok Live studio setup and host curation',
            unit_price: 85000000,
          },
          {
            id: 'prod-seed-2',
            name: 'Custom HD Video Creator Package (40 Ads)',
            description: '40 high-converting short-form HD video ads with script writing',
            unit_price: 1621750,
          },
          {
            id: 'prod-seed-3',
            name: 'Full-Funnel Brand Consulting & Media Buy Retainer',
            description: 'Comprehensive e-commerce strategy & conversion attribution modeling',
            unit_price: 120000000,
          },
        ];

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#d4af37]/20">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-[#d4af37]/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#d4af37]" />
              <span>NEW INVOICE GENERATOR • LUXURY GOLD EXECUTIVE HUD</span>
            </h1>
            <p className="text-xs text-[#d4af37] font-mono">
              INSTANT CATALOG AUTO-FILL & COMPUTATION ENGINE
            </p>
          </div>
        </div>
        <Link
          href="/settings/catalog"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gold-glass-panel text-xs font-bold text-[#f5d77f] hover:border-[#d4af37] transition-all"
        >
          <Package className="w-3.5 h-3.5" />
          <span>MANAGE PRODUCT CATALOG</span>
        </Link>
      </div>

      <NewInvoiceForm clients={clientList} products={productList} />
    </div>
  );
}
