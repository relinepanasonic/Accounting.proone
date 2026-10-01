'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

/** Small clickable thumbnails (click = full size). Pass onRemove to show a delete button on each. */
export function ScreenshotThumbs({
  images,
  onRemove,
  size = 72,
}: {
  images: string[];
  onRemove?: (index: number) => void;
  size?: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (images.length === 0) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <div key={i} className="group relative" style={{ width: size, height: size }}>
            <button
              type="button"
              onClick={() => setOpen(src)}
              className="h-full w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 hover:border-[#d4af37]"
              title="Click to enlarge"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Screenshot ${i + 1}`} className="h-full w-full object-cover object-top" />
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label="Remove screenshot"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(null)}>
          <button type="button" aria-label="Close" className="absolute right-4 top-4 rounded-full bg-zinc-800 p-2 text-white hover:bg-zinc-700" onClick={() => setOpen(null)}>
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open} alt="Screenshot" className="max-h-[92vh] max-w-[96vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
