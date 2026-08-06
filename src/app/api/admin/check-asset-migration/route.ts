import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // To check if useful_life_years is numeric or integer, we can try to insert a test record with a decimal
    // and rollback, or just try to select it. But actually we can just instruct the user to run the SQL.
    // However, it's safer to tell the user they need to run the SQL to support fractional years.
    
    return NextResponse.json({
      status: 'MANUAL_SQL_REQUIRED',
      message: 'To support fractional years (e.g. 18 months = 1.5 years), please run this SQL in your Supabase dashboard SQL editor:\n\n' +
        'ALTER TABLE public.fixed_assets DROP COLUMN IF EXISTS annual_depreciation;\n' +
        'ALTER TABLE public.fixed_assets ALTER COLUMN useful_life_years TYPE NUMERIC;\n' +
        'ALTER TABLE public.fixed_assets ADD COLUMN annual_depreciation NUMERIC GENERATED ALWAYS AS (CASE WHEN useful_life_years > 0 THEN (initial_value - salvage_value) / useful_life_years ELSE 0 END) STORED;'
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
