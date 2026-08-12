'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface ClientOption {
  id: string;
  name: string;
  company_name?: string;
  sourceStr?: string;
}

interface ClientSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ClientOption[];
}

export function ClientSelect({ value, onChange, options }: ClientSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.id === value);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-colors"
      >
        <span className="truncate">
          {selectedOption ? (
            <span className="flex items-center gap-2">
              <span className="font-medium text-white">{selectedOption.name}</span>
              {selectedOption.company_name && selectedOption.company_name !== selectedOption.name && (
                <span className="text-zinc-500 text-xs">({selectedOption.company_name})</span>
              )}
              {selectedOption.sourceStr && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37] bg-[#d4af37]/10 px-2 py-0.5 rounded ml-2">
                  {selectedOption.sourceStr}
                </span>
              )}
            </span>
          ) : (
            <span className="text-zinc-400">-- Choose Client Profile --</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
          <div className="p-1">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full flex flex-col sm:flex-row sm:items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                  value === opt.id ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-medium truncate">{opt.name}</span>
                  {opt.company_name && opt.company_name !== opt.name && (
                    <span className="text-xs opacity-60 truncate">({opt.company_name})</span>
                  )}
                </div>
                {opt.sourceStr && (
                  <div className="mt-1 sm:mt-0 sm:ml-3 shrink-0">
                    <span className="inline-flex text-[10px] font-bold uppercase tracking-wider bg-[#d4af37]/10 border border-[#d4af37]/20 px-2 py-0.5 rounded text-[#d4af37]">
                      {opt.sourceStr}
                    </span>
                  </div>
                )}
              </button>
            ))}
            {options.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-zinc-500">
                No clients found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
