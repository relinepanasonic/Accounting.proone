import { NextResponse } from 'next/server';
import { authenticateApiRequest, corsHeaders, handleOptions } from '@/lib/api/cors';
import { createAdminClient, getNewwaveWorkspaceId } from '@/lib/api/supabase-admin';

export const OPTIONS = handleOptions;

export async function GET(request: Request) {
  try {
    if (!authenticateApiRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const supabase = createAdminClient();
    const workspaceId = await getNewwaveWorkspaceId(supabase);

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, issue_date, due_date, clients(name, contact_name, email)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: invoices }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: Request) {
  try {
    if (!authenticateApiRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { clientName, clientEmail, items, issueDate, dueDate } = body;

    if (!clientName) {
      return NextResponse.json({ error: 'Missing clientName in payload' }, { status: 400, headers: corsHeaders });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Missing or empty items array' }, { status: 400, headers: corsHeaders });
    }

    const supabase = createAdminClient();
    const workspaceId = await getNewwaveWorkspaceId(supabase);

    // 1. Find or Create Client
    let clientId = null;
    const { data: existingClients } = await supabase
      .from('clients')
      .select('id')
      .eq('workspace_id', workspaceId)
      .ilike('name', clientName)
      .limit(1);

    if (existingClients && existingClients.length > 0) {
      clientId = existingClients[0].id;
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          workspace_id: workspaceId,
          name: clientName,
          email: clientEmail || null,
        })
        .select('id')
        .single();
      
      if (clientError) throw clientError;
      clientId = newClient.id;
    }

    // 2. Calculate Totals
    const totalAmount = items.reduce(
      (acc: number, item: any) => acc + (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
      0
    );

    // 3. Generate Invoice Number (e.g. NW2607XXX)
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const invoiceNumber = `NW${dateStr}${randomSuffix}`;

    // 4. Create Invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        workspace_id: workspaceId,
        client_id: clientId,
        invoice_number: invoiceNumber,
        status: 'draft',
        issue_date: issueDate || new Date().toISOString().split('T')[0],
        due_date: dueDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal: totalAmount,
        total_amount: totalAmount,
      })
      .select('id, invoice_number')
      .single();

    if (invoiceError) throw invoiceError;

    // 5. Insert Line Items
    const lineItemsData = items.map((item: any) => ({
      workspace_id: workspaceId,
      invoice_id: invoice.id,
      description: item.description,
      quantity: Number(item.quantity) || 1,
      unit_price: Number(item.unitPrice) || 0,
      total: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
    }));

    const { error: lineItemsError } = await supabase
      .from('invoice_line_items')
      .insert(lineItemsData);

    if (lineItemsError) throw lineItemsError;

    return NextResponse.json({ 
      success: true, 
      message: 'Invoice created successfully',
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        clientId
      }
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
