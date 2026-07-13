import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { NewInvoiceForm } from '@/components/invoices/NewInvoiceForm';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const { data: clients } = await supabase.from('clients').select('id, name');

  const clientList =
    clients && clients.length > 0
      ? clients
      : [
          { id: '22222222-2222-2222-2222-222222222201', name: 'Prof Toko Online' },
          { id: '22222222-2222-2222-2222-222222222202', name: 'Nüman Kitchenware' },
          { id: '22222222-2222-2222-2222-222222222203', name: 'Bochtmon Studio' },
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
              ZERO-JARGON INSTANT COMPUTATION ENGINE
            </p>
          </div>
        </div>
      </div>

      <NewInvoiceForm clients={clientList} />
    </div>
  );
}
