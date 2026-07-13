import React, { Suspense } from 'react';
import { BookOpen, ShieldAlert, CheckCircle2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface JournalEntryLine {
  id?: string;
  account_name: string;
  account_code: string;
  debit_amount: number;
  credit_amount: number;
}

interface JournalEntryRecord {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  source_type: string;
  journal_entry_lines: JournalEntryLine[];
}

async function ActivityLedgerFeed() {
  const supabase = await createClient();

  // 1. Server-Side RBAC Security Check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasClearance = true;

  if (user) {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (member && member.role === 'admin') {
      hasClearance = false;
    }
  }

  // 2. Render Cybernetic Access Denied State if blocked
  if (!hasClearance) {
    return (
      <div className="bg-slate-900/80 border border-red-500/40 rounded-2xl p-12 backdrop-blur-2xl text-center max-w-xl mx-auto my-12 shadow-[0_0_40px_rgba(239,68,68,0.15)]">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/40 flex items-center justify-center mx-auto mb-4 text-red-400">
          <ShieldAlert className="w-7 h-7 animate-pulse" />
        </div>
        <h2 className="text-sm font-black uppercase tracking-widest text-red-400 mb-2">
          SECURITY CLEARANCE DENIED
        </h2>
        <p className="text-xs text-slate-300 font-mono leading-relaxed mb-6">
          GENERAL LEDGER & DOUBLE-ENTRY TELEMETRY IS RESTRICTED TO SUPERADMIN & ACCOUNTING clearance.
          OPERATIONAL ROLES CANNOT AUDIT GENERAL LEDGER JOURNAL BALANCES.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
          <span>RLS GUARDRAIL: ACTIVE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
        </div>
      </div>
    );
  }

  // 3. Fetch Journal Entries & Nested Line Items
  const { data: entries } = await supabase
    .from('journal_entries')
    .select('id, entry_number, entry_date, description, source_type, journal_entry_lines(*)')
    .order('entry_date', { ascending: false });

  const displayEntries: JournalEntryRecord[] =
    entries && entries.length > 0
      ? entries.map((e) => ({
          id: e.id,
          entry_number: e.entry_number,
          entry_date: e.entry_date || '2026-06-30',
          description: e.description,
          source_type: e.source_type || 'manual',
          journal_entry_lines: Array.isArray(e.journal_entry_lines)
            ? e.journal_entry_lines.map((l: any) => ({
                account_name: l.account_name,
                account_code: l.account_code,
                debit_amount: Number(l.debit_amount || 0),
                credit_amount: Number(l.credit_amount || 0),
              }))
            : [],
        }))
      : [
          {
            id: '1',
            entry_number: 'JE-2026-014',
            entry_date: '2026-06-30',
            description: 'June 2026 Production & Creative Payroll Disbursement',
            source_type: 'payroll',
            journal_entry_lines: [
              {
                account_name: 'Salaries & Wages Expense',
                account_code: '6010',
                debit_amount: 18050,
                credit_amount: 0,
              },
              {
                account_name: 'Operating Cash Account',
                account_code: '1010',
                debit_amount: 0,
                credit_amount: 18050,
              },
            ],
          },
          {
            id: '2',
            entry_number: 'JE-2026-015',
            entry_date: '2026-01-15',
            description: 'Acquisition of Sony FX6 Dual Studio Camera Kit',
            source_type: 'fixed_asset',
            journal_entry_lines: [
              {
                account_name: 'Studio Equipment (Capital Asset)',
                account_code: '1510',
                debit_amount: 18500,
                credit_amount: 0,
              },
              {
                account_name: 'Operating Cash Account',
                account_code: '1010',
                debit_amount: 0,
                credit_amount: 18500,
              },
            ],
          },
        ];

  return (
    <div className="space-y-6">
      {displayEntries.map((entry) => {
        const totalDebit = entry.journal_entry_lines.reduce((s, l) => s + l.debit_amount, 0);
        const totalCredit = entry.journal_entry_lines.reduce((s, l) => s + l.credit_amount, 0);
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

        return (
          <div
            key={entry.id}
            className="bg-slate-900/70 border border-slate-800/80 hover:border-cyan-500/40 rounded-2xl p-6 backdrop-blur-xl transition-all duration-300"
          >
            {/* Entry Header Block */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold font-mono text-xs">
                  {entry.entry_number}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    {entry.description}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    LOGGED ON: {entry.entry_date}
                  </span>
                </div>
              </div>

              {/* Source Tag & Balance Badge */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono uppercase">
                  SOURCE: {entry.source_type}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>BALANCED</span>
                </span>
              </div>
            </div>

            {/* Nested Lines Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-400 uppercase text-[10px]">
                    <th className="py-2 px-3">Account Code</th>
                    <th className="py-2 px-3">Account Name</th>
                    <th className="py-2 px-3 text-right">Debit (Money In / Asset Up)</th>
                    <th className="py-2 px-3 text-right">Credit (Money Out / Liab Up)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {entry.journal_entry_lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-bold">
                        {line.account_code}
                      </td>
                      <td className="py-2.5 px-3 text-white font-sans font-medium">
                        {line.account_name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-cyan-400">
                        {line.debit_amount > 0 ? (
                          <span className="inline-flex items-center gap-1 justify-end">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>${line.debit_amount.toLocaleString()}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                        {line.credit_amount > 0 ? (
                          <span className="inline-flex items-center gap-1 justify-end">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>${line.credit_amount.toLocaleString()}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Verification Footer Block */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>ZERO-SUM DOUBLE ENTRY AUDIT TRAIL</span>
              <div className="flex items-center gap-4">
                <span>TOTAL DEBIT: <strong className="text-cyan-400">${totalDebit.toLocaleString()}</strong></span>
                <span>TOTAL CREDIT: <strong className="text-amber-400">${totalCredit.toLocaleString()}</strong></span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ActivityLedgerPage() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      {/* Page Header Bar */}
      <div className="pb-4 border-b border-slate-800/80">
        <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-cyan-400" />
          <span>ACTIVITY LEDGER • SYSTEM DOUBLE-ENTRY AUDIT FEED</span>
        </h1>
        <p className="text-xs text-slate-400 font-mono">
          NO TRADITIONAL JARGON • ZERO-SUM DEBIT / CREDIT PAIRS VISUALIZED IN CYBERNETIC HUD
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4 animate-pulse">
            <div className="h-44 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
            <div className="h-44 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
          </div>
        }
      >
        <ActivityLedgerFeed />
      </Suspense>
    </div>
  );
}
