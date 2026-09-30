import React from 'react';
import { Bot } from 'lucide-react';

export default function AIOfficePage() {
  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">AI Office</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage AI agents, automations, and intelligent workflows.</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center h-[50vh] border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
        <div className="p-6 bg-purple-500/10 rounded-full text-purple-400 mb-6">
          <Bot className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">AI Office Automation</h2>
        <p className="text-sm text-zinc-400 max-w-md text-center">
          This module is currently under development. Soon you will be able to manage your AI workforce directly from this command center.
        </p>
      </div>
    </div>
  );
}
