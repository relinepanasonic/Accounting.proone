import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShieldAlert, FileBarChart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { assignableWorkspaces } from '@/lib/workspaces/assignable';
import { loadLedger, ledgerHealth } from '@/lib/reports/financial-data';
import { profitAndLoss, balanceSheet, cashFlow, daysInMonth } from '@/lib/reports/financial-statements';
import { StatementView } from '@/components/reports/StatementView';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const KINDS = ['profit-loss', 'balance-sheet', 'cash-flow'] as const;
const pad = (n: number) => String(n).padStart(2, '0');

/** Financial statements in the Indonesian standard (PSAK): Laba Rugi, Neraca, Arus Kas. One company, or all of them consolidated. */
export default async function ReportPage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ entity?: string; year?: string; month?: string }> }) {
  const { type } = await params;
  if (!(KINDS as readonly string[]).includes(type)) notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId || !FINANCE_ROLES.includes(ctx.role)) {
    return (
      <div className="p-8"><div className="gold-glass-panel mx-auto max-w-xl rounded-2xl border-red-500/40 p-10 text-center"><ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" /><p className="font-mono text-xs text-zinc-300">The financial statements are for Accounting, Superadmins and the Founder.</p></div></div>
    );
  }

  const entities = await assignableWorkspaces(ctx);
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const thisYear = Number(today.slice(0, 4));
  const year = Number(sp?.year) > 2000 && Number(sp?.year) < 2100 ? Number(sp.year) : thisYear;
  const month = Number(sp?.month) >= 1 && Number(sp?.month) <= 12 ? Number(sp.month) : 0;
  const wanted = String(sp?.entity || '');
  const entityId = wanted === 'all' && entities.length > 1 ? 'all' : entities.find((e) => e.id === wanted)?.id || ctx.activeWorkspaceId;
  const ids = entityId === 'all' ? entities.map((e) => e.id) : [entityId];

  // The period: a month, a whole year, or this year up to today.
  const from = month ? `${year}-${pad(month)}-01` : `${year}-01-01`;
  let to = month ? `${year}-${pad(month)}-${pad(daysInMonth(year, month))}` : `${year}-12-31`;
  if (!month && year === thisYear) to = today;
  if (to > today && month && year === thisYear && month === Number(today.slice(5, 7))) to = today;

  let content: React.ReactNode;
  try {
    const db = createAdminClient();
    // The figures of this company's own books. The statements of another company can only be opened by someone who may enter it.
    const [{ entries, coa, eliminated }, health] = await Promise.all([loadLedger(db, ids, to, entityId === 'all'), ledgerHealth(db, ids)]);
    const entityName = entityId === 'all' ? `Konsolidasi: ${entities.map((e) => e.name).join(', ')}` : entities.find((e) => e.id === entityId)?.name || ctx.activeWorkspaceName;
    const input = { entries, coa, entity: entityName, from, to };
    const statement = type === 'profit-loss' ? profitAndLoss(input) : type === 'balance-sheet' ? balanceSheet(input) : cashFlow(input);
    content = <StatementView statement={statement} kind={type} entities={entities} entityId={entityId} year={year} month={month} years={[]} to={to} eliminated={eliminated} health={health} />;
  } catch (e: any) {
    content = <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-300">Could not build the statement: {e?.message || 'unknown error'}</div>;
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 print:p-0">
      {/* Printing: only the statement, on white paper (no menu, no scroll box). */}
      <style>{`@media print { aside, nav, .fixed, main > :not(.flex-1) { display: none !important; } html, body, main, .flex-1 { overflow: visible !important; height: auto !important; min-height: 0 !important; background: #fff !important; } @page { margin: 14mm; } }`}</style>
      <div className="print:hidden flex items-center gap-3 border-b border-[#d4af37]/20 pb-4">
        <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:border-[#d4af37]/40 hover:text-white"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wider text-white"><FileBarChart className="h-5 w-5 text-[#d4af37]" />Laporan Keuangan</h1>
          <p className="font-mono text-xs uppercase tracking-wider text-[#d4af37]">Financial statements - SAK Indonesia (PSAK)</p>
        </div>
      </div>
      {content}
    </div>
  );
}
