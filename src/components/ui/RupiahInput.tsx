'use client';

import React, { useState } from 'react';

export interface RupiahInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement> & { target: { value: string; name?: string } }) => void;
  onValueChange?: (numericValue: number) => void;
  className?: string;
}

export function RupiahInput({
  value,
  onChange,
  onValueChange,
  className = '',
  placeholder = 'Rp 0',
  onFocus,
  onBlur,
  ...rest
}: RupiahInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const formatToDisplay = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null || val === '') return isFocused ? '' : 'Rp 0';
    if (val === 0 || val === '0') return isFocused ? '' : 'Rp 0';

    const str = String(val);
    const digits = str.replace(/\D/g, '');
    if (!digits) return isFocused ? '' : 'Rp 0';

    const trimmedDigits = digits.replace(/^0+/, '') || '0';
    if (trimmedDigits === '0' && isFocused) return '';

    const formatted = trimmedDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `Rp ${formatted}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    const numericVal = rawDigits ? parseInt(rawDigits, 10) : 0;

    if (onValueChange) {
      onValueChange(numericVal);
    }

    if (onChange) {
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: rawDigits,
        },
      };
      onChange(syntheticEvent as any);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatToDisplay(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className || 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-[#f5d77f] focus:outline-none focus:border-[#d4af37]'}
      {...rest}
    />
  );
}
