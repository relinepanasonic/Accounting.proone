import React from 'react';
import { Megaphone } from 'lucide-react';

export default function AdvertiserDivisionPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] animate-in fade-in zoom-in-95 duration-300">
      <div className="p-6 bg-blue-500/10 rounded-full text-blue-400 mb-6">
        <Megaphone className="w-12 h-12" />
      </div>
      <h1 className="text-3xl font-extrabold text-zinc-100 mb-3 font-serif">Advertiser Division</h1>
      <p className="text-sm text-zinc-400 max-w-md text-center">
        This sub-page is currently under construction. Future updates will include advertiser performance tracking and campaign metrics.
      </p>
    </div>
  );
}
