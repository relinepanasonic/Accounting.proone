import { NextResponse } from 'next/server';
import { authenticateApiRequest, corsHeaders, handleOptions } from '@/lib/api/cors';
import { createAdminClient, getNewwaveWorkspaceId } from '@/lib/api/supabase-admin';

export const OPTIONS = handleOptions;

// ─── GET: list invoices in the New Wave workspace ───────────────────────────
export async function GET(request: Request) {
  try {
    if (!authenticateApiRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const supabase = createAdminClient();
    const workspaceId = await getNewwaveWorkspaceId(supabase);

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, issue_date, due_date, external_id, source, clients(name, contact_name, email)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: invoices }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('GET /invoices error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ─── POST: create or update invoice from New Wave (upserts on source+external_id) ───
export async function POST(request: Request) {
  try {
    if (!authenticateApiRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { source, external_id, clientName, clientEmail, items, issueDate, dueDate, invoiceNumber, status } = body;

    if (!clientName) {
      return NextResponse.json({ error: 'Missing clientName in payload' }, { status: 400, headers: corsHeaders });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Missing or empty items array' }, { status: 400, headers: corsHeaders });
    }

    const supabase = createAdminClient();
    // All inbound invoices from New Wave ALWAYS land in the New Wave workspace.
    // This is explicit and intentional — never left implicit.
    const workspaceId = await getNewwaveWorkspaceId(supabase);

    // 1. Find or Create Client (scoped to New Wave workspace only)
    let clientId: string | null = null;
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
        .insert({ workspace_id: workspaceId, name: clientName, email: clientEmail || null })
        .select('id')
        .single();
      if (clientError) throw clientError;
      clientId = newClient.id;
    }

    // 2. Calculate Totals
    const totalAmount = items.reduce(
      (acc: number, item: any) => acc + (Number(item.quantity) || 1) * (Number(item.unitPrice || item.price) || 0),
      0
    );

    // 3. Determine stable values
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const finalInvoiceNumber = invoiceNumber || `NW${dateStr}${randomSuffix}`;
    const finalIssueDate = issueDate || new Date().toISOString().split('T')[0];
    const finalDueDate = dueDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const finalSource = source || 'new-wave';

    const invoiceData = {
      workspace_id: workspaceId,
      client_id: clientId,
      invoice_number: finalInvoiceNumber,
      status: status || 'draft',
      issue_date: finalIssueDate,
      due_date: finalDueDate,
      subtotal: totalAmount,
      total_amount: totalAmount,
      source: finalSource,
      external_id: external_id || null,
    };

    let invoiceId: string;
    let isUpdate = false;

    // 4. Upsert strategy:
    //    When source + external_id are present, we ONLY match on that pair — never on invoice_number.
    //    This is intentional: invoice_number is not guaranteed stable or unique from New Wave's side.
    //
    //    We use an explicit SELECT then UPDATE/INSERT rather than .upsert() because:
    //    - .upsert() with onConflict requires the DB unique index to exist
    //    - We also need to replace line items only on update
    //
    //    Concurrency protection: the DB unique index on (source, external_id) acts as the
    //    final guard — if two concurrent POSTs race and both try to INSERT, the second will
    //    get a unique violation (error code 23505) which we catch and handle as an UPDATE.
    if (source && external_id) {
      // Explicit match ONLY on (source, external_id) — never fall back to invoice_number
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('source', source)
        .eq('external_id', external_id)
        .maybeSingle();

      if (existing) {
        // ── UPDATE path ──────────────────────────────────────────────────────
        const { error: updateErr } = await supabase
          .from('invoices')
          .update({ ...invoiceData, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (updateErr) throw updateErr;

        // Replace ALL line items (delete-then-reinsert prevents accumulation on repeated pushes)
        await supabase.from('invoice_line_items').delete().eq('invoice_id', existing.id);

        invoiceId = existing.id;
        isUpdate = true;
      } else {
        // ── INSERT path ───────────────────────────────────────────────────────
        const { data: newInv, error: insertErr } = await supabase
          .from('invoices')
          .insert(invoiceData)
          .select('id')
          .single();

        if (insertErr) {
          // Unique constraint violation (23505): concurrent request already inserted this invoice.
          // Retry as an update to stay idempotent.
          if (insertErr.code === '23505') {
            const { data: raceWinner } = await supabase
              .from('invoices')
              .select('id')
              .eq('workspace_id', workspaceId)
              .eq('source', source)
              .eq('external_id', external_id)
              .single();
            if (raceWinner) {
              await supabase.from('invoices').update({ ...invoiceData, updated_at: new Date().toISOString() }).eq('id', raceWinner.id);
              await supabase.from('invoice_line_items').delete().eq('invoice_id', raceWinner.id);
              invoiceId = raceWinner.id;
              isUpdate = true;
            } else {
              throw insertErr;
            }
          } else {
            throw insertErr;
          }
        } else {
          invoiceId = newInv.id;
        }
      }
    } else {
      // No external_id — plain insert (e.g. manually created via old API format)
      const { data: newInv, error: insertErr } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      invoiceId = newInv.id;
    }

    // 5. Insert fresh line items
    const lineItemsData = items.map((item: any) => ({
      workspace_id: workspaceId,
      invoice_id: invoiceId,
      package_name: item.name || item.package_name || null,
      description: item.description || null,
      quantity: Number(item.quantity) || 1,
      scale: item.scale || 'pc',
      unit_price: Number(item.unitPrice || item.price) || 0,
      total: (Number(item.quantity) || 1) * (Number(item.unitPrice || item.price) || 0),
    }));

    await supabase.from('invoice_line_items').insert(lineItemsData);

    return NextResponse.json({
      success: true,
      message: isUpdate ? 'Invoice updated successfully' : 'Invoice created successfully',
      data: { invoiceId, invoiceNumber: finalInvoiceNumber, clientId }
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('POST /invoices error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ─── DELETE: remove invoice by source+external_id (or ?id=) ─────────────────
export async function DELETE(request: Request) {
  try {
    if (!authenticateApiRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const external_id = searchParams.get('external_id');
    const directId = searchParams.get('id');

    const supabase = createAdminClient();
    const workspaceId = await getNewwaveWorkspaceId(supabase);

    let query = supabase.from('invoices').select('id').eq('workspace_id', workspaceId);

    if (directId) {
      query = query.eq('id', directId) as any;
    } else if (source && external_id) {
      query = query.eq('source', source).eq('external_id', external_id) as any;
    } else {
      return NextResponse.json({ error: 'Provide either ?id= or ?source=&external_id=' }, { status: 400, headers: corsHeaders });
    }

    const { data: found } = await query.single();
    if (!found) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404, headers: corsHeaders });
    }

    // Delete line items first, then invoice
    await supabase.from('invoice_line_items').delete().eq('invoice_id', found.id);
    await supabase.from('journal_entries').delete().eq('reference_id', found.id);
    await supabase.from('invoices').delete().eq('id', found.id);

    return NextResponse.json({ success: true, message: 'Invoice deleted', deletedId: found.id }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('DELETE /invoices error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
