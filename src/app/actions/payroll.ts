'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export async function syncNewWavePayroll(month: string, year: string) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!ctx.activeWorkspaceId) {
    throw new Error('Unauthorized');
  }

  // Calculate the end date for the selected month
  // E.g., for '01' '2026', it should be '2026-01-31'
  const targetDate = new Date(Number(year), Number(month), 0); // last day of the month
  const payPeriodStart = `${year}-${month}-01`;
  const payPeriodEnd = targetDate.toISOString().split('T')[0];

  // Based on the user's screenshot, here is the dummy data to "sync" from NW apps
  const syncedData = [
    {
      workspace_id: ctx.activeWorkspaceId,
      employee_name: 'Agung purnama',
      role_title: 'Host',
      department: 'Production',
      base_salary: 120000,
      bonus_amount: 0,
      pay_period_start: payPeriodStart,
      pay_period_end: payPeriodEnd,
      payment_date: payPeriodEnd,
      status: 'draft',
      notes: JSON.stringify({
        tarif_per_jam: 20000,
        jam_terjadwal: 48.0,
        forecast_gaji: 960000,
        jam_dilaporkan: 6.0,
        gaji_aktual: 120000,
        tunjangan: 0,
        bonus: 0,
        bayar_kasbon: 0,
        pinalti: 0
      })
    },
    {
      workspace_id: ctx.activeWorkspaceId,
      employee_name: 'Anggi Alia Gayatri',
      role_title: 'Host',
      department: 'Production',
      base_salary: 0,
      bonus_amount: 0,
      pay_period_start: payPeriodStart,
      pay_period_end: payPeriodEnd,
      payment_date: payPeriodEnd,
      status: 'draft',
      notes: JSON.stringify({
        tarif_per_jam: 25000,
        jam_terjadwal: 26.0,
        forecast_gaji: 650000,
        jam_dilaporkan: 0.0,
        gaji_aktual: 0,
        tunjangan: 0,
        bonus: 0,
        bayar_kasbon: 0,
        pinalti: 0
      })
    },
    {
      workspace_id: ctx.activeWorkspaceId,
      employee_name: 'Host Training',
      role_title: 'Trainee',
      department: 'Training',
      base_salary: 0,
      bonus_amount: 0,
      pay_period_start: payPeriodStart,
      pay_period_end: payPeriodEnd,
      payment_date: payPeriodEnd,
      status: 'draft',
      notes: JSON.stringify({
        tarif_per_jam: 1,
        jam_terjadwal: 36.0,
        forecast_gaji: 36,
        jam_dilaporkan: 0.0,
        gaji_aktual: 0,
        tunjangan: 0,
        bonus: 0,
        bayar_kasbon: 0,
        pinalti: 0
      })
    },
    {
      workspace_id: ctx.activeWorkspaceId,
      employee_name: 'Inayah Aqila Putri',
      role_title: 'Host',
      department: 'Production',
      base_salary: 800000,
      bonus_amount: 0,
      pay_period_start: payPeriodStart,
      pay_period_end: payPeriodEnd,
      payment_date: payPeriodEnd,
      status: 'draft',
      notes: JSON.stringify({
        tarif_per_jam: 20000,
        jam_terjadwal: 52.0,
        forecast_gaji: 1040000,
        jam_dilaporkan: 40.0,
        gaji_aktual: 800000,
        tunjangan: 0,
        bonus: 0,
        bayar_kasbon: 0,
        pinalti: 0
      })
    },
    {
      workspace_id: ctx.activeWorkspaceId,
      employee_name: 'koko',
      role_title: 'Host',
      department: 'Production',
      base_salary: 0,
      bonus_amount: 0,
      pay_period_start: payPeriodStart,
      pay_period_end: payPeriodEnd,
      payment_date: payPeriodEnd,
      status: 'draft',
      notes: JSON.stringify({
        tarif_per_jam: 20000,
        jam_terjadwal: 2.0,
        forecast_gaji: 40000,
        jam_dilaporkan: 0.0,
        gaji_aktual: 0,
        tunjangan: 0,
        bonus: 0,
        bayar_kasbon: 0,
        pinalti: 0
      })
    }
  ];

  // Delete existing draft data for this month to avoid duplicates during testing
  await supabase
    .from('payroll')
    .delete()
    .eq('workspace_id', ctx.activeWorkspaceId)
    .eq('status', 'draft')
    .gte('pay_period_end', `${year}-${month}-01`)
    .lte('pay_period_end', `${year}-${month}-31`);

  const { error } = await supabase.from('payroll').insert(syncedData);

  if (error) {
    console.error('Failed to sync NW apps payroll:', error);
    throw new Error('Sync failed');
  }

  revalidatePath('/payroll');
  return { success: true };
}
