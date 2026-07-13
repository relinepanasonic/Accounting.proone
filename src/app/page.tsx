'use client';

import React, { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Send,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Repeat,
  Sparkles,
  Building2,
  Receipt,
  FileText,
  TrendingUp,
  CreditCard,
  Check
} from 'lucide-react';
import { TERMS } from '@/lib/constants/terminology';

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  deliverableSummary: string;
  amount: number;
  dueDate: string;
  status: 'sent' | 'overdue' | 'paid';
  isRecurring: boolean;
}

interface UpcomingBill {
  id: string;
  vendorName: string;
  description: string;
  amount: number;
  dueDate: string;
  category: string;
}

interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  category: string;
}

export default function ActionOrientedDashboard() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [duplicatedId, setDuplicatedId] = useState<string | null>(null);
  const [remindedId, setRemindedId] = useState<string | null>(null);

  // Realistic seed data matching our Supabase seed script for "New Wave Agency"
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([
    {
      id: 'INV-2026-001',
      invoiceNumber: 'INV-2026-001',
      clientName: 'Professor Toko Online',
      deliverableSummary: '30 TikTok Marketing Scripts & Coffee Shop Video',
      amount: 3600.00,
      dueDate: 'Due in 12 days (Net 15)',
      status: 'sent',
      isRecurring: false,
    },
    {
      id: 'INV-2026-002',
      invoiceNumber: 'INV-2026-002',
      clientName: 'Nüman Kitchenware',
      deliverableSummary: 'Live-stream sales production retainer (Monthly)',
      amount: 4800.00,
      dueDate: 'Due in 5 days',
      status: 'sent',
      isRecurring: true,
    },
  ]);

  const upcomingBills: UpcomingBill[] = [
    {
      id: 'BILL-01',
      vendorName: 'Adobe / Frame.io',
      description: 'Creative Cloud Team Subscription Renewal',
      amount: 299.00,
      dueDate: 'Due in 4 days',
      category: 'Software & Tools',
    },
    {
      id: 'BILL-02',
      vendorName: 'Freelance Editor Invoice #902',
      description: 'TikTok cutdown video editor contractor payout',
      amount: 850.00,
      dueDate: 'Due in 3 days',
      category: 'Contractor Payout',
    },
  ];

  const activityFeed: ActivityItem[] = [
    {
      id: 'ACT-1',
      title: 'Payment Received – Niko Elektronik',
      subtitle: 'INV-2026-003 • Flagship product launch campaign assets',
      amount: 2500.00,
      type: 'income',
      date: '5 days ago',
      category: 'Client Payment',
    },
    {
      id: 'ACT-2',
      title: 'Ring lights and studio gear',
      subtitle: 'Aputure Amaran LED kit & diffusion stands',
      amount: 640.00,
      type: 'expense',
      date: '7 days ago',
      category: 'Gear & Studio',
    },
    {
      id: 'ACT-3',
      title: 'Office staff lunches',
      subtitle: 'Creative team brainstorming catering session',
      amount: 135.50,
      type: 'expense',
      date: '2 days ago',
      category: 'Meals & Entertainment',
    },
  ];

  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalBills = upcomingBills.reduce((sum, bill) => sum + bill.amount, 0);

  const handleCopyPaymentLink = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOneClickDuplicate = (inv: Invoice) => {
    setDuplicatedId(inv.id);
    setTimeout(() => setDuplicatedId(null), 2500);
  };

  const handleSendReminder = (id: string) => {
    setRemindedId(id);
    setTimeout(() => setRemindedId(null), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 font-bold text-black">
              NW
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white tracking-tight">New Wave Agency</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Workspace
                </span>
              </div>
              <p className="text-xs text-slate-400">Frictionless Action Accounting</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-sm font-medium transition-all text-slate-300 hover:text-white">
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Log Expense</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-sm shadow-lg shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5">
              <Sparkles className="w-4 h-4" />
              <span>Create Action Invoice</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Action Hero Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Action Center
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              No financial jargon. Here is where your cash flow stands today.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 px-3.5 py-2 rounded-lg border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Connected to Supabase RLS Multi-Tenant Cloud
          </div>
        </div>

        {/* PRIMARY ACTION BANNERS ("No complex charts - immediate actionable clarity") */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Banner 1: Unpaid Invoices */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-cyan-950/40 border border-cyan-500/30 p-6 shadow-2xl shadow-cyan-950/20 group hover:border-cyan-500/50 transition-all">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-md border border-cyan-500/20">
                  <Clock className="w-3.5 h-3.5" />
                  {TERMS.UNPAID_INVOICES}
                </span>
                <p className="text-3xl font-extrabold text-white mt-3">
                  ${totalUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-slate-300 mt-1">
                  You have <strong className="text-white">{unpaidInvoices.length} unpaid invoices</strong> awaiting collection.
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <ArrowUpRight className="w-6 h-6" />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400">Smart Default: Net 15 terms active</span>
              <button
                onClick={() => handleSendReminder('ALL')}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                {remindedId === 'ALL' ? 'Reminders Sent!' : 'Send 1-Click Reminders'}
              </button>
            </div>
          </div>

          {/* Banner 2: Upcoming Bills */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/30 border border-amber-500/30 p-6 shadow-2xl shadow-amber-950/20 group hover:border-amber-500/50 transition-all">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {TERMS.UPCOMING_BILLS}
                </span>
                <p className="text-3xl font-extrabold text-white mt-3">
                  ${totalBills.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-slate-300 mt-1">
                  You have <strong className="text-white">{upcomingBills.length} upcoming bills</strong> due this week.
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ArrowDownLeft className="w-6 h-6" />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400">Next due: Adobe Creative Cloud</span>
              <button className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all">
                <CreditCard className="w-3.5 h-3.5" />
                Review & Pay Bills
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 2: UNPAID INVOICES & ONE-CLICK ACTIONS */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                {TERMS.UNPAID_INVOICES}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage sent invoices. Duplicate recurring retainers with one click.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {unpaidInvoices.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-mono text-xs font-semibold text-cyan-400 shrink-0">
                    {inv.invoiceNumber.replace('INV-2026-', '#')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{inv.clientName}</span>
                      {inv.isRecurring && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                          <Repeat className="w-3 h-3" /> Recurring Template
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{inv.deliverableSummary}</p>
                    <span className="inline-block text-[11px] text-amber-400 mt-1 font-medium">
                      {inv.dueDate}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">
                      ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[11px] font-medium text-cyan-400 uppercase tracking-wide">
                      Payment Link Active
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Copy Payment Link */}
                    <button
                      onClick={() => handleCopyPaymentLink(inv.id)}
                      className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5"
                      title="Copy Public Stripe Payment Link"
                    >
                      {copiedId === inv.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Link</span>
                        </>
                      )}
                    </button>

                    {/* One-Click Duplicate Action */}
                    <button
                      onClick={() => handleOneClickDuplicate(inv)}
                      className="px-3 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      {duplicatedId === inv.id ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Cloned!</span>
                        </>
                      ) : (
                        <>
                          <Repeat className="w-3.5 h-3.5" />
                          <span>1-Click Duplicate</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: ACTIVITY FEED ("General Ledger mapped to a clean timeline") */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                {TERMS.ACTIVITY_FEED}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                All money coming in and out of your agency in real time.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {activityFeed.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                      item.type === 'income'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400'
                    }`}
                  >
                    {item.type === 'income' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <Receipt className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-slate-400">{item.subtitle}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`text-sm font-bold ${
                      item.type === 'income' ? 'text-emerald-400' : 'text-slate-200'
                    }`}
                  >
                    {item.type === 'income' ? '+' : '-'} $
                    {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    {item.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
