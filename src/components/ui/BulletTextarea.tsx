'use client';

import React, { useRef, useEffect } from 'react';

interface BulletTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

export function BulletTextarea({ value, onChange, className = '', onFocus, onBlur, onKeyDown, onPaste, ...props }: BulletTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Automatically prepend bullet right when user focuses empty textarea
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (!value || !value.trim()) {
      onChange('• ');
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = 2;
        }
      }, 0);
    }
    if (onFocus) onFocus(e);
  };

  // If user leaves textarea and it only contains empty bullet `• `, clean it to empty string
  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (value && value.trim().replace(/^[•\-\*]\s*/, '').trim() === '') {
      onChange('');
    }
    if (onBlur) onBlur(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const el = e.currentTarget;
      const { selectionStart, selectionEnd } = el;
      const val = value || '';

      // Find the start of the current line
      const lastNewLine = val.lastIndexOf('\n', selectionStart - 1);
      const currentLine = val.substring(lastNewLine + 1, selectionStart);

      // Check if current line is an empty bullet (e.g. `• `, `- `, `* ` with no text)
      if (currentLine.trim().match(/^[•\-\*]$/)) {
        e.preventDefault();
        // Remove the empty bullet on this line
        const beforeLine = val.substring(0, lastNewLine + 1);
        const afterLine = val.substring(selectionEnd);
        const newValue = beforeLine + afterLine;
        onChange(newValue);
        setTimeout(() => {
          if (textareaRef.current) {
            const pos = beforeLine.length;
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = pos;
          }
        }, 0);
        return;
      }

      // Check if current line started with a bullet symbol
      const bulletMatch = currentLine.match(/^(\s*[•\-\*]\s*)/);
      const bulletPrefix = bulletMatch ? '• ' : '• ';

      e.preventDefault();
      const before = val.substring(0, selectionStart);
      const after = val.substring(selectionEnd);
      const newValue = `${before}\n${bulletPrefix}${after}`;
      onChange(newValue);

      setTimeout(() => {
        if (textareaRef.current) {
          const pos = selectionStart + 1 + bulletPrefix.length;
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = pos;
        }
      }, 0);
    }

    if (onKeyDown) onKeyDown(e);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText && pastedText.includes('\n')) {
      e.preventDefault();
      const formattedPaste = pastedText
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return '';
          if (trimmed.match(/^[•\-\*]/)) return trimmed;
          return `• ${trimmed}`;
        })
        .join('\n');

      const el = e.currentTarget;
      const { selectionStart, selectionEnd } = el;
      const val = value || '';
      
      // If pasting into empty textarea or start of line, ensure first line has bullet too
      let prefix = '';
      if (selectionStart === 0 && !val) {
        prefix = '';
      } else if (selectionStart > 0 && val[selectionStart - 1] === '\n') {
        prefix = '';
      }

      const newValue = val.substring(0, selectionStart) + prefix + formattedPaste + val.substring(selectionEnd);
      onChange(newValue);

      setTimeout(() => {
        if (textareaRef.current) {
          const pos = selectionStart + prefix.length + formattedPaste.length;
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = pos;
        }
      }, 0);
      return;
    }
    if (onPaste) onPaste(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let newVal = e.target.value;
    // If user starts typing from empty without focus having triggered (e.g. fast typing)
    if (newVal && value === '' && !newVal.startsWith('• ') && !newVal.startsWith('- ') && !newVal.startsWith('* ')) {
      newVal = `• ${newVal}`;
    }
    onChange(newVal);
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className={className}
      {...props}
    />
  );
}
