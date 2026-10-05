import React from 'react';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { InvoiceDocumentView } from '@/lib/invoices/document-view';

export const dynamic = 'force-dynamic';
// A private link meant for one client: keep it out of search engines.
export const metadata: Metadata = { title: 'Invoice', robots: { index: false, follow: false } };

/**
 * The page a client opens from WhatsApp. No login: the long random token in the link is the key, it opens exactly one
 * invoice and expires after 90 days. Nothing else of the system is reachable from here.
 */
export default async function ShareInvoicePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ dl?: string }> }) {
  const { token } = await params;
  const { dl } = await searchParams;
  const db = createAdminClient();

  const valid = /^[A-Za-z0-9_-]{20,80}$/.test(token);
  const { data: share } = valid ? await db.from('invoice_shares').select('invoice_id, expires_at').eq('token', token).maybeSingle() : { data: null as any };
  const ok = share && (!share.expires_at || new Date(share.expires_at) > new Date());

  if (!ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c10] px-6 text-center">
        <div>
          <h1 className="font-serif text-xl font-bold text-white">This invoice link is not valid</h1>
          <p className="mt-2 text-sm text-zinc-400">It may have expired. Please ask the sender for a new link.</p>
        </div>
      </div>
    );
  }

  // dl=1: download straight away. dl=embed: used by the pipeline card (hidden frame) to get the PDF file for WhatsApp.
  return <InvoiceDocumentView db={db} id={share.invoice_id} shareMode autoDownload={dl === '1' || dl === 'embed'} embedPdf={dl === 'embed'} />;
}
