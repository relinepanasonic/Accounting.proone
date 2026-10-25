// The subscriptions this ERP is known to depend on (from the code, the Make.com scenarios and the apps around it).
// Prices are NOT filled in: only the founder knows them. "Add the usual list" on the page inserts these with Rp 0.

export const SUBSCRIPTION_CATEGORIES = ['Database', 'Hosting', 'AI', 'Automation', 'Messaging', 'Storage', 'Domain', 'Apps', 'Code', 'Other'] as const;

export interface KnownSubscription { name: string; category: (typeof SUBSCRIPTION_CATEGORIES)[number]; purpose: string; url?: string }

export const KNOWN_SUBSCRIPTIONS: KnownSubscription[] = [
  { name: 'Supabase', category: 'Database', purpose: 'The ERP database, login and file storage (accounting, clients, invoices)', url: 'https://supabase.com/dashboard' },
  { name: 'Vercel', category: 'Hosting', purpose: 'Hosts the ERP (accounting.profesoronline.id). The Hobby plan is free but allows only 2 daily crons', url: 'https://vercel.com/dashboard' },
  { name: 'Claude (Claude Code / chat)', category: 'AI', purpose: 'Builds and maintains the ERP, answers questions', url: 'https://claude.ai' },
  { name: 'Anthropic API', category: 'AI', purpose: 'The AI Office supervisors (Prof, Acu, Adi, Avi, Selly, Don): pay as you use', url: 'https://console.anthropic.com' },
  { name: 'Make.com', category: 'Automation', purpose: 'Daily/weekly WhatsApp report, PDF reports and the Google Drive sync', url: 'https://www.make.com' },
  { name: 'Fonnte', category: 'Messaging', purpose: 'Sends the WhatsApp messages (reports to Nico, Herlan and Lucy)', url: 'https://fonnte.com' },
  { name: 'Google Drive / Workspace', category: 'Storage', purpose: 'Documentation: invoices, receipts, tax files and reports saved by the sync', url: 'https://drive.google.com' },
  { name: 'Domain profesoronline.id', category: 'Domain', purpose: 'The domain of accounting, dashboard, reline and digitalads' },
  { name: 'Profesor Dashboard app', category: 'Apps', purpose: 'ProOne store numbers (feeds Advertiser Performance). Hosting and database of that app', url: 'https://dashboard.profesoronline.id' },
  { name: 'Reline app', category: 'Apps', purpose: 'Reline, Alpha and Lighting Solution dealers (feeds Advertiser Performance)', url: 'https://reline.profesoronline.id' },
  { name: 'Digital Ads app', category: 'Apps', purpose: 'Client ad reports (Dream of AI)', url: 'https://digitalads.profesoronline.id' },
  { name: 'New Wave app', category: 'Apps', purpose: 'New Wave Live Specialist', url: 'https://app.newwave.id' },
  { name: 'GitHub', category: 'Code', purpose: 'The code of the ERP and the other apps', url: 'https://github.com' },
  { name: 'OpenRouter', category: 'AI', purpose: 'Found in the code as an AI model provider. Remove it if you do not use it', url: 'https://openrouter.ai' },
  { name: 'Google Gemini API', category: 'AI', purpose: 'Found in the code as an AI model provider. Remove it if you do not use it', url: 'https://aistudio.google.com' },
  { name: 'Groq', category: 'AI', purpose: 'Found in the code as an AI model provider. Remove it if you do not use it', url: 'https://console.groq.com' },
  { name: 'DeepSeek', category: 'AI', purpose: 'Found in the code as an AI model provider. Remove it if you do not use it', url: 'https://platform.deepseek.com' },
  { name: 'Z.ai (GLM)', category: 'AI', purpose: 'Found in the code as an AI model provider. Remove it if you do not use it', url: 'https://z.ai' },
];

/** The monthly cost in Rupiah of one subscription (a yearly price counts as one twelfth). */
export function monthlyIdr(s: { amount: number; currency: string; cycle: string; active?: boolean }, usdRate: number): number {
  if (s.active === false) return 0;
  const idr = s.currency === 'USD' ? s.amount * usdRate : s.amount;
  return s.cycle === 'yearly' ? idr / 12 : idr;
}
