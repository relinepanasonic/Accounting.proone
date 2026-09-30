import React from 'react';

export default function PabrikSosmedDivisionPage() {
  return (
    // Crop: shift iframe left to hide sidebar (~260px) and up to hide the top header (~72px)
    <div className="w-full h-[calc(100vh-8rem)] rounded-xl border border-zinc-800/60 overflow-hidden bg-black relative">
      <iframe
        src="https://digitalads.profesoronline.id/social-media?embed=1"
        title="Pabrik Sosmed Dashboard"
        className="border-0 absolute -top-[72px] -left-[260px] w-[calc(100%+260px)] h-[calc(100%+72px)]"
        allow="clipboard-write; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
