'use client';

import React, { useState, useTransition } from 'react';
import { Plus, Users, Mail, Building2, Loader2, AlertCircle } from 'lucide-react';
import { createClientRecord } from '@/app/actions/settings';

export interface ClientRecord {
  id: string;
  name: string;
  company?: string;
  email?: string;
}

interface ClientCrmManagerProps {
  initialClients: ClientRecord[];
}

export function ClientCrmManager({ initialClients }: ClientCrmManagerProps) {
  const [clients, setClients] = useState<ClientRecord[]>(initialClients);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await createClientRecord({
          name,
          contactPerson,
          email,
        });

        if (!res.success) {
          setErrorMsg(res.error || 'Failed to create client');
        } else {
          setClients((prev) => [
            {
              id: Math.random().toString(),
              name,
              company: contactPerson || name,
              email,
            },
            ...prev,
          ]);
          setName('');
          setContactPerson('');
          setEmail('');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Error creating client');
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Quick Add Client Form */}
      <form
        onSubmit={handleAddClient}
        className="gold-glass-panel rounded-3xl p-6 space-y-4 lg:col-span-1 h-fit"
      >
        <div className="border-b border-[#d4af37]/20 pb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#d4af37]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            ONBOARD NEW CLIENT
          </h3>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/60 text-[#f5d77f] text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              COMPANY NAME *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Nüman Kitchenware Indonesia"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              PRIMARY CONTACT PERSON
            </label>
            <input
              type="text"
              placeholder="e.g. Hendra Santoso (Director)"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
              BILLING EMAIL ADDRESS
            </label>
            <input
              type="email"
              placeholder="billing@numan.co.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="gold-btn w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : (
            <Plus className="w-4 h-4 text-black" />
          )}
          <span>REGISTER CLIENT ACCOUNT</span>
        </button>
      </form>

      {/* Clients CRM Table */}
      <div className="gold-glass-panel rounded-3xl p-6 lg:col-span-2 space-y-4">
        <div className="border-b border-[#d4af37]/20 pb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            CLIENT DIRECTORY & BILLING PROFILES ({clients.length} ACCOUNTS)
          </h3>
          <span className="text-[10px] font-mono text-[#f5d77f]">INSTANT INVOICING READY</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="py-3 px-3">COMPANY NAME</th>
                <th className="py-3 px-3">CONTACT PERSON</th>
                <th className="py-3 px-3">BILLING EMAIL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-xs">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3.5 px-3 font-bold text-white">{c.name}</td>
                  <td className="py-3.5 px-3 text-zinc-300">{c.company || '—'}</td>
                  <td className="py-3.5 px-3 font-mono text-[#f5d77f]">{c.email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
