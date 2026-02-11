'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, X } from 'lucide-react';

export type SearchableOption<T = unknown> = {
  value: string;
  label: string;
  description?: string;
  meta?: string;
  keywords?: string[];
  disabled?: boolean;
  data?: T;
};

type Props<T = unknown> = {
  value: string;
  onChange: (value: string, option?: SearchableOption<T>) => void;
  options: SearchableOption<T>[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  emptyText?: string;
  minQueryLength?: number;
  required?: boolean;
  ariaLabel?: string;

  // Optional controlled input text (useful for async typeahead)
  query?: string;
  onQueryChange?: (query: string) => void;

  // Optional controlled open state (useful when parent wants to gate async fetch)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  // Optional UX helpers
  recentKey?: string;
  pinnedValues?: string[];
  allowClear?: boolean;
  syncQueryOnSelect?: boolean;
};

function safeParseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => String(v)).filter(Boolean);
  } catch {
    return [];
  }
}

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export default function SearchableSelect<T = unknown>({
  value,
  onChange,
  options,
  placeholder = '選択してください',
  searchPlaceholder,
  disabled = false,
  loading = false,
  error,
  emptyText = '該当する項目がありません',
  minQueryLength = 0,
  required = false,
  ariaLabel,
  query,
  onQueryChange,
  open,
  onOpenChange,
  recentKey,
  pinnedValues = [],
  allowClear = true,
  syncQueryOnSelect = true,
}: Props<T>) {
  const controlledQuery = typeof query === 'string';
  const controlledOpen = typeof open === 'boolean';

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value]
  );

  const [internalQuery, setInternalQuery] = useState<string>('');
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(0);
  const [recents, setRecents] = useState<string[]>([]);

  const listRef = useRef<HTMLDivElement | null>(null);

  const isOpen = controlledOpen ? (open as boolean) : internalOpen;
  const inputValue = controlledQuery ? (query as string) : internalQuery;

  const setOpen = (next: boolean) => {
    if (controlledOpen) {
      onOpenChange?.(next);
      return;
    }
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const setQuery = (next: string) => {
    if (controlledQuery) {
      onQueryChange?.(next);
      return;
    }
    setInternalQuery(next);
  };

  // Initialize query to selected label (uncontrolled only).
  useEffect(() => {
    if (controlledQuery) return;
    setInternalQuery(selected?.label || '');
  }, [controlledQuery, selected?.label]);

  // Load recents.
  useEffect(() => {
    if (!recentKey) return;
    if (typeof window === 'undefined') return;
    setRecents(safeParseArray(localStorage.getItem(recentKey)));
  }, [recentKey]);

  const normalizedQuery = inputValue.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (normalizedQuery.length < minQueryLength) return [];
    if (!normalizedQuery) return options;

    return options.filter((o) => {
      const hay = [
        o.label,
        o.description || '',
        o.meta || '',
        ...(o.keywords || []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [minQueryLength, normalizedQuery, options]);

  const ordered = useMemo(() => {
    const pinned = new Set(pinnedValues || []);
    const recent = new Set(recents || []);

    const score = (v: string) => (pinned.has(v) ? 0 : recent.has(v) ? 1 : 2);

    return [...filtered].sort((a, b) => {
      const sa = score(a.value);
      const sb = score(b.value);
      if (sa !== sb) return sa - sb;
      return a.label.localeCompare(b.label, 'ja');
    });
  }, [filtered, pinnedValues, recents]);

  const showHint = !disabled && isOpen && normalizedQuery.length < minQueryLength;

  const selectOption = (opt: SearchableOption<T>) => {
    if (opt.disabled) return;

    // Save recent selection (best-effort).
    if (recentKey && typeof window !== 'undefined') {
      const next = uniq([opt.value, ...(recents || [])]).slice(0, 7);
      setRecents(next);
      try {
        localStorage.setItem(recentKey, JSON.stringify(next));
      } catch {
        // ignore
      }
    }

    onChange(opt.value, opt);

    // Update input text.
    if (controlledQuery) {
      if (syncQueryOnSelect) {
        onQueryChange?.(opt.label);
      }
    } else {
      setInternalQuery(opt.label);
    }

    setOpen(false);
  };

  const closeAndRevert = () => {
    setOpen(false);
    if (!controlledQuery) {
      setInternalQuery(selected?.label || '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setOpen(true);
      return;
    }

    if (!isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeAndRevert();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, Math.max(ordered.length - 1, 0)));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'Enter') {
      // When the dropdown is open, Enter must not submit the surrounding form.
      e.preventDefault();
      if (ordered.length === 0) return;
      const opt = ordered[highlightIndex] || ordered[0];
      if (opt) selectOption(opt);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setHighlightIndex(0);
  }, [isOpen, normalizedQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-idx="${highlightIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, isOpen]);

  const showClearButton =
    allowClear &&
    !disabled &&
    Boolean(value) &&
    Boolean(selected) &&
    !loading;

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          onBlur={() => {
            // Allow click selection before closing
            setTimeout(() => closeAndRevert(), 150);
          }}
          onKeyDown={handleKeyDown}
          className="input-field pr-10"
          placeholder={searchPlaceholder || placeholder}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
          autoComplete="off"
        />

        {showClearButton ? (
          <button
            type="button"
            onClick={() => {
              onChange('', undefined);
              if (controlledQuery) {
                onQueryChange?.('');
              } else {
                setInternalQuery('');
              }
              setOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-[var(--color-accent)]"
            aria-label="選択をクリア"
          >
            <X size={16} className="text-[color:var(--color-muted-foreground)]" />
          </button>
        ) : loading ? (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[color:var(--color-muted-foreground)]"
          />
        ) : (
          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-muted-foreground)]"
          />
        )}
      </div>

      {isOpen && (showHint || error || ordered.length > 0 || normalizedQuery.length >= minQueryLength) ? (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-popover)] shadow-lg max-h-72 overflow-auto"
        >
          {showHint ? (
            <div className="px-3 py-2 text-sm text-[color:var(--color-muted-foreground)]">
              {minQueryLength}文字以上で検索できます
            </div>
          ) : null}

          {error ? (
            <div className="px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          ) : null}

          {!loading && !error && ordered.length === 0 && normalizedQuery.length >= minQueryLength ? (
            <div className="px-3 py-2 text-sm text-[color:var(--color-muted-foreground)]">{emptyText}</div>
          ) : null}

          {ordered.map((opt, idx) => {
            const active = idx === highlightIndex;
            const isPinned = (pinnedValues || []).includes(opt.value);
            const isRecent = (recents || []).includes(opt.value);

            return (
              <button
                key={opt.value}
                type="button"
                data-idx={idx}
                className={`w-full px-3 py-2 text-left transition-colors ${
                  opt.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : active
                      ? 'bg-[var(--color-accent)]'
                      : 'hover:bg-[var(--color-accent)]'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(opt);
                }}
                disabled={opt.disabled}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-[color:var(--color-popover-foreground)] truncate">
                      {opt.label}
                    </div>
                    {opt.description ? (
                      <div className="text-xs text-[color:var(--color-muted-foreground)] truncate">
                        {opt.description}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {opt.meta ? (
                      <div className="text-xs text-[color:var(--color-muted-foreground)] whitespace-nowrap">
                        {opt.meta}
                      </div>
                    ) : null}
                    {isPinned ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-secondary)] text-[color:var(--color-secondary-foreground)] border border-[var(--color-border)] whitespace-nowrap">
                        自分
                      </span>
                    ) : isRecent ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-muted)] text-[color:var(--color-muted-foreground)] border border-[var(--color-border)] whitespace-nowrap">
                        最近
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
