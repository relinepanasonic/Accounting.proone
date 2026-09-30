import React from 'react';

export default function PabrikSosmedDivisionPage() {
  return (
    // Outer div clips the iframe. We shift the iframe left to hide the external app's sidebar.
    <div className="w-full h-[calc(100vh-8rem)] rounded-xl border border-zinc-800/60 overflow-hidden bg-black relative">
      <iframe
        src="https://digitalads.profesoronline.id/social-media?embed=1"
        title="Pabrik Sosmed Dashboard"
        className="h-full border-0 absolute top-0 -left-[260px] w-[calc(100%+260px)]"
        allow="clipboard-write; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
