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

    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, email, phone, contact_name, created_at')
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: clients }, { headers: corsHeaders });

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
    const { name, email, phone, contactName } = body;

    if (!name) {
      return NextResponse.json({ error: 'Missing client name in payload' }, { status: 400, headers: corsHeaders });
    }

    const supabase = createAdminClient();
    const workspaceId = await getNewwaveWorkspaceId(supabase);

    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        workspace_id: workspaceId,
        name,
        email: email || null,
        phone: phone || null,
        contact_name: contactName || null,
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: newClient }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
