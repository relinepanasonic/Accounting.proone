import React from 'react';

export function ProfessorTokoOnlineLogo({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Navy Shield Crest Outline */}
      <path
        d="M10 32C10 32 60 12 70 10C80 12 130 32 130 32V75C130 115 70 140 70 140C70 140 10 115 10 75V32Z"
        fill="#ffffff"
        stroke="#18233c"
        strokeWidth="8"
        strokeLinejoin="round"
      />

      {/* Silver/Grey Gear Cog at the Base */}
      <g transform="translate(70, 92)">
        <path
          d="M-28 0C-28-15.5-15.5-28 0-28C15.5-28 28-15.5 28 0C28 15.5 15.5 28 0 28C-15.5 28-28 15.5-28 0Z"
          fill="#cbd5e1"
        />
        {/* Gear Teeth */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, idx) => (
          <rect
            key={idx}
            x="-6"
            y="-34"
            width="12"
            height="10"
            rx="2"
            fill="#94a3b8"
            transform={`rotate(${angle})`}
          />
        ))}
        {/* Inner Cutout */}
        <circle cx="0" cy="4" r="16" fill="#ffffff" />
      </g>

      {/* Shopping Cart Icon inside the Gear Base */}
      <g transform="translate(56, 85)">
        <path
          d="M0 0H5L8 14H22L25 4H7"
          stroke="#1e293b"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="18" r="2.5" fill="#1e293b" />
        <circle cx="20" cy="18" r="2.5" fill="#1e293b" />
      </g>

      {/* Dark Navy Graduation Cap (Mortarboard) */}
      <g transform="translate(70, 52)">
        {/* Cap Base */}
        <path d="M-22 6V20C-22 26 22 26 22 20V6Z" fill="#1e293b" />
        {/* Cap Top Diamond */}
        <path d="M0 -14L-42 0L0 14L42 0L0 -14Z" fill="#18233c" />
        {/* Gold Button & Tassel */}
        <circle cx="0" cy="0" r="3.5" fill="#d4af37" />
        <path
          d="M0 0L-24 4V22"
          stroke="#d4af37"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="-24" cy="24" r="3" fill="#d4af37" />
      </g>

      {/* Dynamic Gold Upward-Trending Arrow Slashing Across Center */}
      <path
        d="M22 102L56 74L78 92L116 52"
        stroke="#d4af37"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M98 52H116V70"
        stroke="#d4af37"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
