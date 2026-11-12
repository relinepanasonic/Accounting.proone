'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { linkClientToGroup } from '@/app/actions/wa';

/**
 * The WhatsApp group of a client (Client Contact). One group per client: its brands and stores share it, so the choice is saved
 * on every brand row of the company. Oli sends the weekly report and the session reports to this group.
 */
export function WaGroupSelect({ clientIds, value, groups }: { clientIds: string[]; value: string | null; groups: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <div className="px-1">
      <select
        disabled={pending}
        value={value || ''}
        onChange={(e) => start(async () => {
          setErr('');
          const results: any[] = await Promise.all(clientIds.map((id) => linkClientToGroup(id, e.target.value || null)));
          const bad = results.find((r) => r?.error);
          if (bad) setErr(bad.error); else router.refresh();
        })}
        className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1.5 text-xs text-zinc-200 hover:border-zinc-700 focus:border-[#d4af37]/60 focus:bg-zinc-900 focus:outline-none disabled:opacity-60"
        title="The client's WhatsApp group. Oli must be a member of it."
      >
        <option value="">{groups.length ? 'No group' : 'No groups yet'}</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
      </select>
      {err && <div className="mt-0.5 text-[10px] text-red-400">{err}</div>}
    </div>
  );
}
