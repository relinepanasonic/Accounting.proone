import React from 'react';

/** The company logo (the shield with the graduation cap). Used where an invoice has no logo of its own. */
export function ProfessorTokoOnlineLogo({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo (8).png" alt="Professor Toko Online" className={`${className} rounded-lg object-contain`} />
  );
}
