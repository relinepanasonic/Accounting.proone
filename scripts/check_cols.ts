import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const activeWorkspaceId = 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3';
  const { data: assets } = await supabase.from('fixed_assets').select('*').eq('workspace_id', activeWorkspaceId);
  const asset = assets.find(a => a.asset_name.includes('Kulkas Puan'));
  
  if (!asset) return console.log("Not found");
  
  console.log("Found:", asset);
  
  const { data: existingEntries } = await supabase
    .from('journal_entries')
    .select('transaction_date')
    .eq('workspace_id', activeWorkspaceId)
    .eq('reference_id', asset.id)
    .eq('reference_type', 'depreciation');
    
  console.log("Existing Entries:", existingEntries);
  
  const loggedMonths = new Set((existingEntries || []).map(e => e.transaction_date.substring(0, 7)));
  
  let purchaseDate = new Date(asset.purchase_date || asset.created_at);
  const today = new Date();
  
  const startDate = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);
  const endDate = new Date(today.getFullYear(), today.getMonth(), 1);
  
  let currentDate = startDate;
  let count = 0;
  while (currentDate <= endDate) {
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const monthKey = `${yyyy}-${mm}`;

    if (!loggedMonths.has(monthKey)) {
        console.log("Will log for:", monthKey);
        count++;
    }
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  console.log("Total to log:", count);
}
main();
