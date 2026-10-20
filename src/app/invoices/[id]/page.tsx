import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';
import { InvoiceDocumentView } from '@/lib/invoices/document-view';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { PT_WORKSPACE_ID } from '@/lib/workspaces/known';
import { FINANCE_ROLES } from '@/lib/auth/workspace-context';

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

  // A PT Pintu invoice assigned to this workspace may be opened (read only) by its finance people.
  let db: any = supabase;
  if (!row && FINANCE_ROLES.includes(viewer.role)) {
    const admin = createAdminClient();
    const { data: shared } = await admin.from('invoices').select('workspace_id, assigned_workspace_id').eq('id', id).maybeSingle();
    if (shared && shared.workspace_id === PT_WORKSPACE_ID && shared.assigned_workspace_id === viewer.activeWorkspaceId) db = admin;
  }

  return <InvoiceDocumentView db={db} id={id} isReceipt={sp?.receipt === 'true'} hideClient={hideClient} />;
}
