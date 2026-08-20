'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2, Edit2 } from 'lucide-react';
import { deleteFixedAsset } from '@/app/actions/fixed-assets';

interface AssetRowActionsProps {
  id: string;
}

export function AssetRowActions({ id }: AssetRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (confirm('Are you sure you want to permanently delete this fixed asset?')) {
      const row = e.currentTarget.closest('tr');
      if (row) row.style.display = 'none'; // Optimistic delete

      startTransition(async () => {
        try {
          const res = await deleteFixedAsset(id);
          if (res?.error) {
            if (row) row.style.display = ''; // Revert on failure
            alert(res.error);
          } else {
            router.refresh(); // Ensure Client Component state forces a refresh to remove the item instantly
          }
        } catch (err: any) {
          console.error(err);
          if (row) row.style.display = '';
          alert(err.message || 'Failed to delete fixed asset');
        }
      });
    }
  };

  return (
    <div className="inline-flex items-center justify-end gap-2">
      <Link
        href={/assets/ + id + /edit}
        className="inline-flex p-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700 hover:border-[#d4af37] text-zinc-400 hover:text-[#d4af37] hover:scale-105 transition-all duration-200"
        title="Edit Asset Schedule"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </Link>
      <button
        onClick={handleDelete}
        disabled={isPending}
        title="Delete Fixed Asset"
        className="p-1.5 rounded-lg bg-red-900/20 border border-red-500/30 hover:border-red-400 text-red-400 hover:text-red-300 hover:scale-105 transition-all duration-200"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
