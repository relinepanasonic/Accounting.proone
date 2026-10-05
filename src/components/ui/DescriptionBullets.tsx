'use client';

import React from 'react';

interface DescriptionBulletsProps {
  description?: string | null;
  isDark?: boolean;
  allBullets?: boolean;
  className?: string;
  headerClassName?: string;
  bulletClassName?: string;
}

export function DescriptionBullets({
  description,
  isDark = true,
  allBullets = false,
  className = '',
  headerClassName = '',
  bulletClassName = '',
}: DescriptionBulletsProps) {
  if (!description || !description.trim()) return null;

  // Split by newline or vertical bar ` | `
  const rawLines = description.includes('\n')
    ? description.split('\n')
    : (description.includes(' | ') ? description.split(' | ') : description.split('\n'));

  const cleanLines = rawLines
    .map((l) => l.trim())
    .filter(Boolean);

  if (cleanLines.length === 0) return null;

  // Check if first line is a title/header (not starting with bullet) and there are more lines
  const firstLineIsTitle = !allBullets && !cleanLines[0].match(/^[•\-\*]/) && cleanLines.length > 1;

  // If there's only 1 line and no bullet requested or detected
  if (cleanLines.length === 1 && !allBullets && !cleanLines[0].match(/^[•\-\*]/)) {
    return (
      <div className={`leading-relaxed ${className || (isDark ? 'text-zinc-300' : 'text-[#1e2536]')}`}>
        {cleanLines[0]}
      </div>
    );
  }

  const title = firstLineIsTitle ? cleanLines[0] : null;
  const bullets = (firstLineIsTitle ? cleanLines.slice(1) : cleanLines).map((l) =>
    l.replace(/^[•\-\*]\s*/, '')
  );

  const dotColor = isDark ? 'bg-[#d4af37]' : 'bg-[#1e2536]';
  const textColor = isDark ? 'text-white' : 'text-[#1e2536] font-semibold';
  const subTextColor = isDark ? 'text-zinc-400' : 'text-[#1e2536]/80 font-normal';

  return (
    <div className={`space-y-0.5 font-sans ${className}`}>
      {title && (
        <div className={`leading-tight ${headerClassName || textColor}`}>
          {title}
        </div>
      )}
      <ul className="space-y-0.5 mt-0.5 list-none pl-0">
        {bullets.map((line, idx) => (
          // Block layout with an absolutely placed dot (no flex): wrapped lines keep a reliable height, also when drawn into the PDF picture.
          <li key={idx} className={`relative block pl-3 text-xs leading-snug break-words ${bulletClassName || subTextColor}`} style={{ whiteSpace: 'normal' }}>
            <span className={`absolute left-0 top-[0.45em] inline-block w-1 h-1 rounded-full ${dotColor}`} />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
