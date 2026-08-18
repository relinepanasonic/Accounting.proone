'use client';

import React, { useState, useEffect } from 'react';

export interface RupiahInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement> & { target: { value: string; name?: string } }) => void;
  onValueChange?: (numericValue: number) => void;
  className?: string;
  decimals?: number;
}

export function RupiahInput({
  value,
  onChange,
  onValueChange,
  className = '',
  placeholder = 'Rp 0',
  decimals = 0,
  onFocus,
  onBlur,
  ...rest
}: RupiahInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [localDisplay, setLocalDisplay] = useState<string>('');

  const formatExternalValue = (val: string | number | undefined | null, focused: boolean) => {
    if (val === undefined || val === null || val === '') return focused ? '' : (decimals > 0 ? `Rp 0,${'0'.repeat(decimals)}` : 'Rp 0');
    if (val === 0 || val === '0') return focused ? '' : (decimals > 0 ? `Rp 0,${'0'.repeat(decimals)}` : 'Rp 0');
    
    // val could be a raw number or string like "1000.5" from state
    let str = String(val);
    str = str.replace('.', ','); // Convert float decimal to comma
    str = str.replace(/[^0-9,]/g, ''); // strip invalid chars

    const parts = str.split(',');
    let intPart = parts[0] || '0';
    let decPart = parts.length > 1 ? parts[1] : null;

    intPart = intPart.replace(/^0+/, '') || '0';
    if (intPart === '0' && focused && !decPart && !str.includes(',')) return '';

    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    if (!focused && decimals > 0) {
      // When blurred, always show exactly `decimals` decimal places
      const paddedDec = (decPart || '').padEnd(decimals, '0').slice(0, decimals);
      return `Rp ${formattedInt},${paddedDec}`;
    }

    if (decPart !== null) {
      return `Rp ${formattedInt},${decPart}`;
    } else if (str.endsWith(',')) {
      return `Rp ${formattedInt},`;
    }
    return `Rp ${formattedInt}`;
  };

  useEffect(() => {
    if (!isFocused) {
      setLocalDisplay(formatExternalValue(value, false));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawStr = e.target.value;
    
    // Clean up input: remove "Rp " and thousand separator dots
    rawStr = rawStr.replace(/^Rp\s?/, '');
    rawStr = rawStr.replace(/\./g, '');
    rawStr = rawStr.replace(/[^0-9,]/g, '');

    const commaParts = rawStr.split(',');
    if (commaParts.length > 2) {
      rawStr = commaParts[0] + ',' + commaParts.slice(1).join('');
    }

    setLocalDisplay(formatExternalValue(rawStr, true));

    const stringForNumber = rawStr.replace(',', '.');
    const numericVal = stringForNumber ? parseFloat(stringForNumber) : 0;

    if (onValueChange) {
      onValueChange(numericVal);
    }

    if (onChange) {
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: stringForNumber,
        },
      };
      onChange(syntheticEvent as any);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    setLocalDisplay(formatExternalValue(value, true));
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    setLocalDisplay(formatExternalValue(value, false));
    if (onBlur) onBlur(e);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={isFocused ? localDisplay : formatExternalValue(value, false)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className || 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-[#f5d77f] focus:outline-none focus:border-[#d4af37]'}
      {...rest}
    />
  );
}
