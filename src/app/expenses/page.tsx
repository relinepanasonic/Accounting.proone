import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Plus, Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ExpenseRowActions } from '@/components/expenses/ExpenseRowActions';

export const dynamic = 'force-dynamic';

interface ExpenseRecord {
  id: string;
  date: string;
  vendor: string;
  category: string;
  amount: number;
  status: string;
}

async function ExpensesTable() {
  const supabase = await createClient();

  const { data: records, error } = await supabase
    .from('transactions')
    .select('id, due_date, description, category, amount, status')
    .eq('is_upcoming_bill', true)
    .order('due_date', { ascending: true });

  const displayRecords: ExpenseRecord[] =
    records && records.length > 0
      ? records.map((r) => ({
          id: r.id,
          date: r.due_date || '2026-07-15',
          vendor: r.description || 'Vendor Payee',
          category: r.category || 'Software & Operations',
          amount: Number(r.amount || 0),
          status: r.status || 'pending',
        }))
      : [
          {
            id: '1',
            date: '2026-07-07',
            vendor: 'Cloud Server Hosting A/P',
            category: 'Software & Infrastructure',
            amount: 1200,
            status: 'pending',
          },
          {
            id: '2',
            date: '2026-07-10',
            vendor: 'Studio Rent & Production Power',
            category: 'Office & Utilities',
            amount: 4300,
            status: 'pending',
          },
          {
            id: '3',
            date: '2026-07-12',
            vendor: 'Affiliator Agency Creator Payouts',
            category: 'Creator Partnerships',
            amount: 8500,
            status: 'pending',
          },
          {
            id: '4',
            date: '2026-07-14',
            vendor: 'Adobe Creative Cloud Team License',
            category: 'Software & Subscriptions',
            amount: 480,
            status: 'paid',
          },
        ];

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            UPCOMING PAYABLES & VENDOR BILLS
          </h2>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            COPPER-GOLD ACCENTS • ALL AGENCY ROLES AUTHORIZED
          </p>
        </div>
        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
          MONEY OUT TELEMETRY
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-sans">
              <th className="py-3 px-3">Due Date</th>
              <th className="py-3 px-3">Vendor / Payee</th>
              <th className="py-3 px-3">Category</th>
              <th className="py-3 px-3 text-right">Amount Owed</th>
              <th className="py-3 px-3 text-center">Status Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {displayRecords.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-slate-800/40 transition-colors group"
              >
                <td className="py-3 px-3 text-slate-400 font-bold">
                  {item.date}
                </td>
                <td className="py-3 px-3 font-sans font-semibold text-white group-hover:text-amber-300 transition-colors">
                  {item.vendor}
                </td>
                <td className="py-3 px-3">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 font-mono">
                    {item.category}
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="text-sm font-black text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                    -${item.amount.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <ExpenseRowActions id={item.id} status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            <span>EXPENSES • VENDOR PAYABLES & A/P OUTFLOW HUD</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            ACTION-ORIENTED BILL MANAGEMENT • ZERO SPREADSHEET HEADACHE
          </p>
        </div>

        <Link
          href="/expenses/new"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all transform hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          <span>RECORD NEW EXPENSE</span>
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl h-80 animate-pulse p-6"></div>
        }
      >
        <ExpensesTable />
      </Suspense>
    </div>
  );
}
