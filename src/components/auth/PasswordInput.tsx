'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { inputClassName?: string };

// Password box with an eye button to show what was typed.
export function PasswordInput({ inputClassName, className, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`relative ${className || ''}`}>
      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[#d4af37]/70" />
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={
          inputClassName ||
          'w-full bg-zinc-950/90 border border-zinc-800/90 rounded-xl pl-10 pr-11 py-2.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-[#d4af37]'
        }
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-2.5 p-1 text-zinc-400 hover:text-[#f5d77f] transition-colors"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
