'use client';

import React, { useRef, useEffect, useState, memo } from 'react';
import { CAMPAIGN_STATUS_LABELS, type CampaignStatus } from '@/lib/constants';
import { toHalfWidth } from '@/lib/product-code';

export type EditableField = 'item_code' | 'agreed_amount' | 'status';

interface EditableCellProps {
  field: EditableField;
  value: unknown;
  isActive: boolean;
  onChange: (value: unknown) => void;
  onActivate: () => void;
  onNavigate: (direction: 'next' | 'prev' | 'down' | 'up') => void;
  onDeactivate: () => void;
}

const normalizeNumeric = (v: string) =>
  toHalfWidth(v).replace(/[^\d]/g, '');

function EditableCellInner({
  field,
  value,
  isActive,
  onChange,
  onActivate,
  onNavigate,
  onDeactivate,
}: EditableCellProps) {
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const [localValue, setLocalValue] = useState<string>('');

  useEffect(() => {
    if (isActive) {
      setLocalValue(String(value ?? ''));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        if (inputRef.current instanceof HTMLInputElement) {
          inputRef.current.select();
        }
      });
    }
  }, [isActive, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      commitValue();
      onNavigate(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commitValue();
      onNavigate('down');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onDeactivate();
    }
  };

  const commitValue = () => {
    if (field === 'agreed_amount') {
      const num = Number(normalizeNumeric(localValue));
      onChange(Number.isFinite(num) ? Math.max(0, num) : 0);
    } else {
      onChange(localValue);
    }
  };

  // Display mode
  if (!isActive) {
    return (
      <div
        className="cursor-pointer px-2 py-1 rounded hover:bg-accent/50 min-h-[28px] min-w-[60px] transition-colors"
        onClick={onActivate}
        onDoubleClick={onActivate}
        tabIndex={0}
        onFocus={onActivate}
        role="button"
      >
        {renderDisplayValue(field, value)}
      </div>
    );
  }

  // Edit mode: status uses select
  if (field === 'status') {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChange(e.target.value);
          onNavigate('next');
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          commitValue();
          onDeactivate();
        }}
        className="w-full bg-background border border-primary/50 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {Object.entries(CAMPAIGN_STATUS_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
    );
  }

  // Edit mode: numeric field (agreed_amount)
  if (field === 'agreed_amount') {
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        inputMode="numeric"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          commitValue();
          onDeactivate();
        }}
        className="w-full bg-background border border-primary/50 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-right"
        placeholder="¥"
      />
    );
  }

  // Edit mode: text field (item_code)
  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        commitValue();
        onDeactivate();
      }}
      className="w-full bg-background border border-primary/50 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      placeholder="品番"
    />
  );
}

function renderDisplayValue(field: EditableField, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground/50">—</span>;
  }

  if (field === 'status') {
    const label = CAMPAIGN_STATUS_LABELS[value as CampaignStatus] || String(value);
    return <span className="text-sm">{label}</span>;
  }

  if (field === 'agreed_amount') {
    const num = Number(value);
    return <span className="text-sm tabular-nums">¥{num.toLocaleString()}</span>;
  }

  return <span className="text-sm">{String(value)}</span>;
}

export const EditableCell = memo(EditableCellInner);
