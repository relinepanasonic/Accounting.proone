import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { NewInvoiceForm } from '@/components/invoices/NewInvoiceForm';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .order('name', { ascending: true });

  const displayClients =
    clients && clients.length > 0
      ? clients
      : [
          { id: '22222222-2222-2222-2222-222222222201', name: 'Prof Toko Online' },
          { id: '22222222-2222-2222-2222-222222222202', name: 'Nüman Kitchenware' },
        ];

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-slate-800/80">
        <h1 className="text-lg font-extrabold tracking-wider uppercase text-white">
          ACTION INVOICE GENERATOR
        </h1>
        <p className="text-xs text-slate-400 font-mono">
          SMART DEFAULTS • INSTANT CLIENT-SIDE CALCULATIONS • NO SPREADSHEET MATH
        </p>
      </div>

      <NewInvoiceForm clients={displayClients} />
    </div>
  );
}
