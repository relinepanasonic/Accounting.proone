import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { ClientCrmManager, type ClientRecord } from '@/components/settings/ClientCrmManager';

export const dynamic = 'force-dynamic';

export default async function ClientsSettingsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, company, email')
    .order('name', { ascending: true });

  const fallbackClients: ClientRecord[] = [
    {
      id: 'c-1',
      name: 'Nüman Kitchenware',
      company: 'Hendra Santoso (VP Marketing)',
      email: 'accounting@numan.co.id',
    },
    {
      id: 'c-2',
      name: 'Bochtmon Studio',
      company: 'Adrian Widjaya (Creative Dir)',
      email: 'finance@bochtmon.id',
    },
    {
      id: 'c-3',
      name: 'PT Mitra Teknologi Mandiri',
      company: 'Dewi Lestari (CFO)',
      email: 'invoice@mitratek.co.id',
    },
  ];

  const clientList = clients && clients.length > 0 ? clients : fallbackClients;

  return <ClientCrmManager initialClients={clientList} />;
}
