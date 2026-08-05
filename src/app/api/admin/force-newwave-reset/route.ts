import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();
    const apiKey = process.env.ACCOUNTING_API_KEY || process.env.NEWWAVE_INTEGRATION_TOKEN;

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
    }

    // Find New Wave Workspace
    const { data: workspaces } = await supabase.from('workspaces').select('id, name');
    const newWaveWs = workspaces?.find((w: any) => w.name.toLowerCase().includes('new wave'));
    
    if (!newWaveWs) {
      return NextResponse.json({ error: 'New Wave workspace not found' }, { status: 404 });
    }

    // Get all invoices NOT in New Wave Workspace
    const { data: wrongInvoices } = await supabase
      .from('invoices')
      .select('*, clients(*), invoice_line_items(*)')
      .neq('workspace_id', newWaveWs.id);

    if (!wrongInvoices || wrongInvoices.length === 0) {
      return NextResponse.json({ message: 'No incorrect invoices found to reset.' });
    }

    const results = [];

    for (const inv of wrongInvoices) {
      // 1. Try to DELETE the invoice on New Wave
      const deleteRes = await fetch(`https://app.newwave.id/api/accounting/invoices/${inv.id}?source=proone`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (deleteRes.ok) {
        results.push({ id: inv.id, invoice_number: inv.invoice_number, action: 'deleted' });
      } else {
        // Fallback: If DELETE doesn't exist, POST it as 'cancelled'
        const clientName = Array.isArray(inv.clients) ? inv.clients[0]?.name : inv.clients?.name;
        const payload = {
          source: 'proone',
          external_id: inv.id,
          invoice_number: inv.invoice_number,
          brand: clientName || 'Unknown Client',
          invoice_date: inv.issue_date,
          due_date: inv.due_date,
          status: 'cancelled', // Force cancellation
          notes: 'Auto-cancelled: Wrong Workspace',
          items: []
        };

        const postRes = await fetch('https://app.newwave.id/api/accounting/invoices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (postRes.ok) {
          results.push({ id: inv.id, invoice_number: inv.invoice_number, action: 'cancelled' });
        } else {
          results.push({ id: inv.id, invoice_number: inv.invoice_number, action: 'failed', status: postRes.status });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Reset complete',
      processed: results.length,
      details: results
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
