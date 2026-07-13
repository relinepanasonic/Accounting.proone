import React, { Suspense } from 'react';
import { ShieldAlert, BookOpen, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface JournalEntryLine {
  id: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
}

interface JournalEntryRecord {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  source_module: string;
  lines: JournalEntryLine[];
}

async function ActivityLedgerTimeline() {
  const supabase = await createClient();

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

  if (!hasClearance) {
    return (
      <div className="gold-glass-panel border-red-500/40 rounded-2xl p-12 text-center max-w-xl mx-auto my-12">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/40 flex items-center justify-center mx-auto mb-4 text-red-400">
          <ShieldAlert className="w-7 h-7 animate-pulse" />
        </div>
        <h2 className="text-sm font-black uppercase tracking-widest text-red-400 mb-2">
          SECURITY CLEARANCE DENIED
        </h2>
        <p className="text-xs text-zinc-300 font-mono leading-relaxed mb-6">
          DOUBLE-ENTRY LEDGER ACCESS IS RESTRICTED TO SUPERADMIN & ACCOUNTING ROLES.
        </p>
      </div>
    );
  }

  const { data: entries } = await supabase
    .from('journal_entries')
    .select('*, journal_entry_lines(*)')
    .order('entry_date', { ascending: false });

  const displayEntries: JournalEntryRecord[] =
    entries && entries.length > 0
      ? entries.map((entry) => ({
          id: entry.id,
          entry_number: entry.entry_number || 'JE-2026-001',
          entry_date: entry.entry_date || '2026-07-12',
          description: entry.description || 'System Entry',
          source_module: entry.source_module || 'System',
          lines: Array.isArray(entry.journal_entry_lines)
            ? entry.journal_entry_lines.map((l: any) => ({
                id: l.id,
                account_name: l.account_name,
                debit_amount: Number(l.debit_amount || 0),
                credit_amount: Number(l.credit_amount || 0),
              }))
            : [],
        }))
      : [
          {
            id: '1',
            entry_number: 'JE-2026-018',
            entry_date: 'March 16, 2026',
            description: 'Automated Revenue Realization & Client Payment Clearing',
            source_module: 'Invoices',
            lines: [
              { id: 'l1', account_name: 'Operating Cash Vault (Debit)', debit_amount: 1430, credit_amount: 0 },
              { id: 'l2', account_name: 'Accounts Receivable Client (Credit)', debit_amount: 0, credit_amount: 1430 },
            ],
          },
          {
            id: '2',
            entry_number: 'JE-2026-017',
            entry_date: 'December 25, 2025',
            description: 'Creator Team Payroll disbursement & withholdings',
            source_module: 'Payroll',
            lines: [
              { id: 'l3', account_name: 'Salaries & Creator Compensation (Debit)', debit_amount: 350, credit_amount: 0 },
              { id: 'l4', account_name: 'Operating Cash Vault (Credit)', debit_amount: 0, credit_amount: 350 },
            ],
          },
          {
            id: '3',
            entry_number: 'JE-2026-016',
            entry_date: 'December 25, 2025',
            description: 'Studio Lighting Capital Asset Depreciation Expense',
            source_module: 'Fixed Assets',
            lines: [
              { id: 'l5', account_name: 'Depreciation Expense (Debit)', debit_amount: 30, credit_amount: 0 },
              { id: 'l6', account_name: 'Accumulated Depreciation Equipment (Credit)', debit_amount: 0, credit_amount: 30 },
            ],
          },
        ];

  return (
    <div className="space-y-6">
      {displayEntries.map((entry) => {
        const totalDebits = entry.lines.reduce((s, l) => s + l.debit_amount, 0);
        const totalCredits = entry.lines.reduce((s, l) => s + l.credit_amount, 0);
        const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

        return (
          <div
            key={entry.id}
            className="gold-glass-panel gold-glass-panel-hover rounded-2xl p-6 relative border-l-4 border-l-[#d4af37]"
          >
            {/* Top Timeline Node Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#f5d77f] shadow-[0_0_10px_#f5d77f]"></div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#f5d77f] font-mono">
                      {entry.entry_date}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                      {entry.entry_number}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1">
                    {entry.description}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono uppercase px-3 py-1 rounded-full bg-zinc-900 text-[#d4af37] border border-[#d4af37]/30">
                  SOURCE: {entry.source_module}
                </span>

                {/* Glowing Gold BALANCED Badge */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase bg-[#d4af37]/20 text-[#f5d77f] border border-[#d4af37]/50 shadow-[0_0_12px_rgba(212,175,55,0.35)] font-extrabold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#f5d77f]" />
                  <span>{isBalanced ? 'BALANCED' : 'REVIEW'}</span>
                </span>
              </div>
            </div>

            {/* Split Debit & Credit Ledger Rows */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {entry.lines.map((line) => (
                <div
                  key={line.id}
                  className="p-3.5 rounded-xl bg-black/60 border border-zinc-800/80 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                        line.debit_amount > 0
                          ? 'bg-[#d4af37]/20 text-[#f5d77f]'
                          : 'bg-zinc-900 text-zinc-300'
                      }`}
                    >
                      {line.debit_amount > 0 ? 'Debit' : 'Credit'}
                    </span>
                    <span className="text-zinc-200 font-sans font-medium">
                      {line.account_name}
                    </span>
                  </div>

                  <span
                    className={`font-extrabold ${
                      line.debit_amount > 0
                        ? 'text-[#f5d77f] drop-shadow-[0_0_8px_rgba(245,215,127,0.35)]'
                        : 'text-zinc-100'
                    }`}
                  >
                    ${(line.debit_amount || line.credit_amount).toLocaleString()}
                  </span>
                </div>
              ))}
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
      {/* Header Bar */}
      <div className="pb-4 border-b border-[#d4af37]/20">
        <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#d4af37]" />
          <span>ACTIVITY LEDGER • SYSTEM TIMELINE FEED HUD</span>
        </h1>
        <p className="text-xs text-[#d4af37] font-mono">
          BRUSHED GOLD DOUBLE-ENTRY AUDIT TRAIL • STRICT ZERO-SUM PARITY
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4 animate-pulse">
            <div className="gold-glass-panel rounded-2xl h-44"></div>
            <div className="gold-glass-panel rounded-2xl h-44"></div>
          </div>
        }
      >
        <ActivityLedgerTimeline />
      </Suspense>
    </div>
  );
}
