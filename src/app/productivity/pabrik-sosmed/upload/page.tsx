import React from 'react';
import { UploadCloud } from 'lucide-react';

export default function PabrikSosmedUpload() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-16rem)] animate-in fade-in zoom-in-95 duration-300">
      <div className="p-6 bg-emerald-500/10 rounded-full text-emerald-400 mb-6">
        <UploadCloud className="w-12 h-12" />
      </div>
      <h2 className="text-2xl font-bold text-zinc-100 mb-3">Upload Media</h2>
      <p className="text-sm text-zinc-400 max-w-md text-center">
        This page will allow you to send or receive media files and data to your other web app via API integration.
      </p>
    </div>
  );
}
