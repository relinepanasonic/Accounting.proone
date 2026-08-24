import React from 'react';
import { Calendar } from 'lucide-react';
import { formatIndoDate } from '@/lib/utils';

interface DatePickerUIProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  required?: boolean;
}

export function DatePickerUI({ value, onChange, className = '', required = false }: DatePickerUIProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Invisible native input for the popup calendar */}
      <input
        type="date"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
      {/* Custom styled overlay */}
      <div className="pointer-events-none w-full h-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus-within:border-[#d4af37] font-mono flex items-center justify-between group">
        <span>{value ? formatIndoDate(value) : 'Select Date...'}</span>
        <Calendar className="w-4 h-4 text-[#d4af37]/70 group-hover:text-[#d4af37] transition-colors" />
      </div>
    </div>
  );
}
