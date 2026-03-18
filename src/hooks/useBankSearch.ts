'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface BankOption {
  code: string;
  name: string;
  kana: string;
}

export interface BranchOption {
  code: string;
  name: string;
  kana: string;
}

const DEBOUNCE_MS = 300;

export function useBankSearch(query: string) {
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    const trimmed = query.trim();
    if (!trimmed) {
      setBanks([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/form/banks?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Failed to search banks');
        const data = await res.json();
        if (!controller.signal.aborted) {
          setBanks(data.banks || []);
          setLoading(false);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setError('金融機関の検索に失敗しました');
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query]);

  return { banks, loading, error };
}

export function useBranchSearch(bankCode: string, query: string) {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBranches = useCallback(
    async (nextQuery: string) => {
      if (!bankCode) {
        setBranches([]);
        return;
      }
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      try {
        const url = nextQuery.trim()
          ? `/api/form/banks/${bankCode}/branches?q=${encodeURIComponent(nextQuery.trim())}`
          : `/api/form/banks/${bankCode}/branches`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to search branches');
        const data = await res.json();
        if (!controller.signal.aborted) {
          setBranches(data.branches || []);
          setLoading(false);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setError('支店の検索に失敗しました');
          setLoading(false);
        }
      }
    },
    [bankCode]
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!bankCode) {
      setBranches([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    timerRef.current = setTimeout(() => {
      void fetchBranches(query);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [bankCode, query, fetchBranches]);

  return { branches, loading, error };
}
