import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function NoAccessPage() {
  return (
    <div className="gold-glass-panel border-red-500/40 rounded-2xl p-12 text-center max-w-xl mx-auto my-12">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/40 flex items-center justify-center mx-auto mb-4 text-red-400">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <h2 className="text-sm font-black uppercase tracking-widest text-red-400 mb-2">NO WORKSPACE ACCESS</h2>
      <p className="text-xs text-zinc-300 font-mono leading-relaxed">
        Your account is not a member of any workspace yet. Ask a Superadmin to invite you.
      </p>
    </div>
  );
}
