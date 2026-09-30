import React from 'react';

export default function PabrikSosmedDivisionPage() {
  return (
    <div className="w-full h-[calc(100vh-8rem)] rounded-xl border border-zinc-800/60 overflow-hidden bg-black relative">
      <iframe
        src="https://digitalads.profesoronline.id/social-media?embed=1"
        title="Pabrik Sosmed Dashboard"
        /* 
          Using a CSS crop hack to hide the left sidebar from the external app.
          If the sidebar width changes in the other app, adjust the '260px' values below.
        */
        className="h-full border-0 absolute top-0 -left-[260px] w-[calc(100%+260px)] md:-left-[260px] md:w-[calc(100%+260px)]"
        allow="clipboard-write; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
