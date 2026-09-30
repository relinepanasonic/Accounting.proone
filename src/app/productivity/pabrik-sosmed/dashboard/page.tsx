import React from 'react';
import { BarChart3 } from 'lucide-react';

export default function PabrikSosmedDashboard() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-16rem)] animate-in fade-in zoom-in-95 duration-300">
      <div className="p-6 bg-blue-500/10 rounded-full text-blue-400 mb-6">
        <BarChart3 className="w-12 h-12" />
      </div>
      <h2 className="text-2xl font-bold text-zinc-100 mb-3">Dashboard</h2>
      <p className="text-sm text-zinc-400 max-w-md text-center">
        This page will display aggregated analytics and metrics from your other web app via API integration.
      </p>
    </div>
  );
}
