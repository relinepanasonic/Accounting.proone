const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedPayroll() {
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id')
    .ilike('name', '%New Wave%')
    .limit(1);

  if (wsError || !workspaces || workspaces.length === 0) {
    console.error('Error finding workspace:', wsError);
    return;
  }
  
  const workspaceId = workspaces[0].id;

  const dummyData = [
    {
      workspace_id: workspaceId,
      employee_name: 'DEWI PUSPITA SARI',
      role_title: 'Live-stream Host',
      department: 'Production',
      base_salary: 4000000,
      bonus_amount: 510000,
      pay_period_start: '2026-01-01',
      pay_period_end: '2026-01-25',
      payment_date: '2026-01-26',
      status: 'draft',
      notes: 'Monthly fixed salary + performance bonus (January)'
    },
    {
      workspace_id: workspaceId,
      employee_name: 'DIRA RAMADHANI',
      role_title: 'Video Editor',
      department: 'Post-Production',
      base_salary: 2200000,
      bonus_amount: 0,
      pay_period_start: '2026-01-01',
      pay_period_end: '2026-01-25',
      payment_date: '2026-01-26',
      status: 'draft',
      notes: 'Monthly fixed salary (January)'
    },
    {
      workspace_id: workspaceId,
      employee_name: 'ANGGI ALIA GAYATRI',
      role_title: 'Content Creator',
      department: 'Production',
      base_salary: 2000000,
      bonus_amount: 160000,
      pay_period_start: '2026-01-01',
      pay_period_end: '2026-01-25',
      payment_date: '2026-01-26',
      status: 'paid',
      notes: 'Monthly fixed salary + extra hours'
    }
  ];

  const { error: insertError } = await supabase
    .from('payroll')
    .insert(dummyData);

  if (insertError) {
    console.error('Failed to seed payroll:', insertError);
  } else {
    console.log('Successfully seeded 3 dummy payroll records!');
  }
}

seedPayroll();
