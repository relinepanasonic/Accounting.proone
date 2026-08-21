const fs = require('fs');
const code = \import React, { Suspense } from 'react';
import { ShieldAlert, BookOpen, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

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
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasClearance = true;

  if (user) {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', activeWorkspaceId)
      .limit(1)
      .single();

    if (member && !['admin', 'superadmin', 'accounting', 'founder'].includes(member.role)) {
      hasClearance = false;
    }
  }

  if (!hasClearance) {
    return (
      <div className="gold-glass-panel border-red-500/40 rounded-2xl p-12 text-center max-w-xl mx-auto my-12 shadow-[0_0_40px_rgba(239,68,68,0.15)]">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/40 flex items-center justify-center mx-auto mb-4 text-red-400">
          <ShieldAlert className="w-7 h-7 animate-pulse" />
        </div>
        <h2 className="text-sm font-black uppercase tracking-widest text-red-400 mb-2">
          SECURITY CLEARANCE DENIED
        </h2>
        <p className="text-xs text-zinc-300 font-mono leading-relaxed">
          DOUBLE-ENTRY LEDGER ACCESS IS RESTRICTED TO SUPERADMIN & ACCOUNTING ROLES.
        </p>
      </div>
    );
  }

  // Fetch flat journal_entries
  const { data: rawLines } = await supabase
    .from('journal_entries')
    .select('*, global_chart_of_accounts(account_name)')
    .eq('workspace_id', activeWorkspaceId)
    .order('transaction_date', { ascending: false });

  // Group by reference_id
  const grouped: Record<string, JournalEntryRecord> = {};

  if (rawLines) {
    rawLines.forEach((line) => {
      const ref = line.reference_id || line.id; // fallback to line id if no ref
      if (!grouped[ref]) {
        grouped[ref] = {
          id: ref,
          entry_number: \\\JE-\\\\\\,
          entry_date: line.transaction_date,
          description: line.description || 'System Entry',
          source_module: line.reference_type || 'System',
          lines: []
        };
      }
      grouped[ref].lines.push({
        id: line.id,
        account_name: (line.global_chart_of_accounts && line.global_chart_of_accounts.length > 0) ? line.global_chart_of_accounts[0]?.account_name || line.account_code : line.account_code,
        debit_amount: Number(line.debit_amount || 0),
        credit_amount: Number(line.credit_amount || 0),
      });
    });
  }

  const displayEntries = Object.values(grouped).sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());

  return (
    <div className="space-y-6">
      {displayEntries.length === 0 ? (
        <div className="gold-glass-panel rounded-2xl p-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mx-auto text-[#f5d77f]">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Double-Entry Journal Entries Posted Yet</h3>
            <p className="text-xs text-zinc-400 font-sans mt-1">Activity ledger transactions are automatically generated when you issue invoices, record expenses, or reconcile bank statements.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {displayEntries.map((entry) => (
            <div
              key={entry.id}
              className="gold-glass-panel rounded-2xl p-6 transition-all hover:border-[#d4af37]/30 hover:shadow-[0_0_20px_rgba(212,175,55,0.05)]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-800/80">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-bold text-white font-mono bg-zinc-900 px-2 py-0.5 rounded">
                      {entry.entry_number}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#d4af37]/10 text-[#f5d77f] border border-[#d4af37]/20">
                      {entry.source_module.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-sans">{entry.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-white bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800 inline-block">
                    {entry.entry_date}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-zinc-500 uppercase tracking-wider border-b border-zinc-800/60">
                      <th className="pb-3 pl-2 font-medium">Account</th>
                      <th className="pb-3 text-right font-medium w-1/4">Debit</th>
                      <th className="pb-3 pr-2 text-right font-medium w-1/4">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {entry.lines.map((line, idx) => (
                      <tr key={line.id} className="group hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3 pl-2 text-zinc-300 font-sans font-medium flex items-center gap-2">
                          {line.credit_amount > 0 && <span className="w-4" />}
                          {line.account_name}
                        </td>
                        <td className="py-3 text-right">
                          {line.debit_amount > 0 ? (
                            <span className="text-white font-bold">
                              Rp {line.debit_amount.toLocaleString('en-US')}
                            </span>
                          ) : (
                            <span className="text-zinc-700">-</span>
                          )}
                        </td>
                        <td className="py-3 pr-2 text-right">
                          {line.credit_amount > 0 ? (
                            <span className="text-[#d4af37] font-bold">
                              Rp {line.credit_amount.toLocaleString('en-US')}
                            </span>
                          ) : (
                            <span className="text-zinc-700">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-700/80 bg-zinc-900/30">
                      <td className="py-3 pl-2 font-bold text-zinc-400 uppercase tracking-widest text-[10px]">Totals</td>
                      <td className="py-3 text-right font-bold text-white">
                        Rp {entry.lines.reduce((sum, l) => sum + l.debit_amount, 0).toLocaleString('en-US')}
                      </td>
                      <td className="py-3 pr-2 text-right font-bold text-[#d4af37]">
                        Rp {entry.lines.reduce((sum, l) => sum + l.credit_amount, 0).toLocaleString('en-US')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LedgerPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#d4af37]/20">
        <div>
          <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#d4af37]" />
            <span>ACTIVITY LEDGER • REALTIME DOUBLE-ENTRY MATRIX</span>
          </h1>
          <p className="text-xs text-[#d4af37] font-mono mt-1">
            GLOBAL FINANCIAL TELEMETRY • IMMUTABLE AUDIT TRAIL
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 uppercase tracking-wider bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
          <CheckCircle2 className="w-3 h-3 text-[#d4af37]" />
          LEDGER SYNCHRONIZED
        </div>
      </div>

      <Suspense
        fallback={
          <div className="gold-glass-panel rounded-2xl p-12 text-center text-[#d4af37] font-mono text-xs uppercase tracking-widest animate-pulse">
            Decrypting Global Ledger Matrix...
          </div>
        }
      >
        <ActivityLedgerTimeline />
      </Suspense>
    </div>
  );
}
\;

fs.writeFileSync('src/app/ledger/page.tsx', code, { encoding: 'utf8' });
