import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { GeneralSettingsForm } from '@/components/settings/GeneralSettingsForm';
import { RegisterWorkspaceCard } from '@/components/settings/RegisterWorkspaceCard';

export const dynamic = 'force-dynamic';

export default async function GeneralSettingsPage() {
  const supabase = await createClient();
  const { data: workspaces } = await supabase.from('workspaces').select('*').limit(1);
  const ws = workspaces?.[0];

  return (
    <div className="space-y-8">
      <GeneralSettingsForm
        initialName={ws?.name || 'Professor Toko Online'}
        initialTaxRate={ws?.tax_rate_percent !== undefined ? Number(ws.tax_rate_percent) : 11}
        initialInstructions={
          ws?.payment_instructions ||
          'BCA Virtual Account: 88019-212-5120\nBank Mandiri Corporate: 102-000-988-111'
        }
      />

      {/* Register New Enterprise Tenant Card */}
      <RegisterWorkspaceCard />
    </div>
  );
}
