import React from 'react';

export default function PabrikSosmedDivisionPage() {
  return (
    <div className="w-full h-[calc(100vh-8rem)] rounded-xl border border-zinc-800/60 overflow-hidden bg-black">
      <iframe
        src="https://digitalads.profesoronline.id/social-media?embed=1"
        title="Pabrik Sosmed Dashboard"
        className="w-full h-full border-0"
        allow="clipboard-write; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
