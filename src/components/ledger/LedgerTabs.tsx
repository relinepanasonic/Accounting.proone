import Link from 'next/link';

/** Activity Ledger | Ledger Check. */
export function LedgerTabs({ active }: { active: 'ledger' | 'check' }) {
  const items = [
    { key: 'ledger', name: 'Activity Ledger', href: '/ledger' },
    { key: 'check', name: 'Ledger Check', href: '/ledger/check' },
  ] as const;
  return (
    <div className="flex w-fit gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
            active === i.key ? 'border border-[#d4af37]/30 bg-[#0e0f14] text-[#d4af37] shadow-md' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {i.name}
        </Link>
      ))}
    </div>
  );
}
