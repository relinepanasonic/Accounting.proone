import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';
import { InvoiceDocumentView } from '@/lib/invoices/document-view';

export const dynamic = 'force-dynamic';

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function InvoiceDetailPage({ params, searchParams }: InvoiceDetailPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  // Whether this viewer may see the client of a protected workspace's invoice.
  const viewer = await getAuthenticatedWorkspaceContext(supabase);
  const { data: row } = await supabase.from('invoices').select('assigned_workspace_id').eq('id', id).maybeSingle();
  const hideClient = clientMask({ userEmail: viewer.userEmail, availableWorkspaces: viewer.availableWorkspaces }).hides(row?.assigned_workspace_id);

  return <InvoiceDocumentView db={supabase} id={id} isReceipt={sp?.receipt === 'true'} hideClient={hideClient} />;
}
