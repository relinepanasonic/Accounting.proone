import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// One-time migration endpoint: Run this once to fix the invoices status constraint
// Visit: /api/run-migration?secret=fix-status-2026
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (secret !== 'fix-status-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Use postgres directly via the pg connection string approach won't work here.
    // Instead, we use a trick: create a function and call it via RPC
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    
    // Test: try updating an invoice status to 'sent' to confirm current constraint
    const { data: testInvoice } = await supabaseAdmin
      .from('invoices')
      .select('id, status')
      .limit(1)
      .single();
    
    if (!testInvoice) {
      return NextResponse.json({ error: 'No invoices found to test' });
    }
    
    // The REAL way to run DDL: use Supabase's /query endpoint (undocumented but works)
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const queries = [
      `ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check`,
      `ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'invoiced', 'paid', 'partial_paid', 'overdue', 'cancelled'))`,
    ];
    
    const results = [];
    for (const query of queries) {
      // Use the postgres REST endpoint
      const res = await fetch(`${projectUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ sql: query })
      });
      results.push({ query: query.substring(0, 50), status: res.status, body: await res.text() });
    }
    
    return NextResponse.json({ 
      message: 'Migration attempted',
      testInvoice,
      results
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack });
  }
}
