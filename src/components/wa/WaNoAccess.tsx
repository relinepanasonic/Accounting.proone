import React from 'react';
import { ShieldAlert } from 'lucide-react';

export function WaNoAccess() {
  return (
    <div className="mx-auto max-w-xl p-12 text-center">
      <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
      <p className="text-sm text-zinc-300">WA Control shows private chats. It is for accounting, admin, superadmin and the founder.</p>
    </div>
  );
}
