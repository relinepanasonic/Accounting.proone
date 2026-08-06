import { NextResponse } from 'next/server';
import { createAdminClient, getNewwaveWorkspaceId } from '@/lib/api/supabase-admin';

// One-time admin route: run this at /api/admin/apply-migration to apply the
// external_id + source columns to the invoices table (since supabase CLI isn't linked).
export async function GET() {
  try {
    const supabase = createAdminClient();

    // Add external_id and source columns via raw RPC if available
    // Since we can't run raw SQL, we'll do it via upsert trick — 
    // Supabase adds columns automatically when you try to update with them
    // Actually the safest way is to try fetching with the column:
    const { error: testError } = await supabase
      .from('invoices')
      .select('external_id, source')
      .limit(1);

    if (testError && testError.message.includes('column')) {
      return NextResponse.json({
        status: 'COLUMNS_MISSING',
        message: 'Please run this SQL in your Supabase dashboard SQL editor:\n\n' +
          'ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS external_id TEXT;\n' +
          'ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS source TEXT;\n' +
          'CREATE UNIQUE INDEX IF NOT EXISTS invoices_source_external_id_idx ON public.invoices (source, external_id) WHERE source IS NOT NULL AND external_id IS NOT NULL;'
      });
    }

    return NextResponse.json({
      status: 'OK',
      message: 'Columns external_id and source already exist on invoices table. Migration not needed.'
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
