'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { addNote, deleteNote } from '@/app/actions/planner';

export function NotesWidget({ notes }: { notes: { id: string; content: string }[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError('');
      const res = await addNote(text);
      if (!res.success) return setError(res.error);
      setText('');
      setAdding(false);
      router.refresh();
    });
  const remove = (id: string) =>
    start(async () => {
      await deleteNote(id);
      router.refresh();
    });

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-100">Quick Notes</h3>
        <button onClick={() => setAdding((a) => !a)} aria-label="Add a note" className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 hover:bg-[#d4af37]/20 hover:text-[#f5d77f]"><Plus className="h-4 w-4" /></button>
      </div>
      {adding && (
        <div className="mb-3 space-y-2">
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="A quick note..." className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-[#d4af37] focus:outline-none" />
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={pending || !text.trim()} className="rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f5d77f] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40">Save</button>
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
        </div>
      )}
      <ul className="space-y-2 text-sm text-zinc-300">
        {notes.length === 0 && !adding && <li className="text-xs text-zinc-600">No notes yet. Press + to write one.</li>}
        {notes.slice(0, 6).map((n) => (
          <li key={n.id} className="group flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d4af37]" />
            <span className="min-w-0 flex-1 break-words">{n.content}</span>
            <button onClick={() => remove(n.id)} aria-label="Delete note" className="opacity-0 transition-opacity group-hover:opacity-100 text-zinc-600 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
