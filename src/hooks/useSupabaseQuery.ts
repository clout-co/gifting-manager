'use client';

import { useState, useCallback } from 'react';
import { PostgrestError } from '@supabase/supabase-js';
import { translateError } from '@/lib/toast';

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseSupabaseQueryReturn<T> extends QueryState<T> {
  execute: () => Promise<T | null>;
  setData: (data: T | null) => void;
  reset: () => void;
}

/**
 * Supabaseクエリを安全に実行するためのカスタムフック
 * エラーハンドリングとローディング状態を自動管理
 */
export function useSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
    initialData?: T | null;
  }
): UseSupabaseQueryReturn<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: options?.initialData ?? null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (): Promise<T | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await queryFn();

      if (error) {
        const errorMessage = translateError(error);
        setState(prev => ({ ...prev, loading: false, error: errorMessage }));
        options?.onError?.(errorMessage);
        return null;
      }

      setState({ data, loading: false, error: null });
      if (data) {
        options?.onSuccess?.(data);
      }
      return data;
    } catch (err) {
      const errorMessage = translateError(err);
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      options?.onError?.(errorMessage);
      return null;
    }
  }, [queryFn, options]);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  const reset = useCallback(() => {
    setState({
      data: options?.initialData ?? null,
      loading: false,
      error: null,
    });
  }, [options?.initialData]);

  return {
    ...state,
    execute,
    setData,
    reset,
  };
}

/**
 * Supabaseミューテーション（insert, update, delete）を安全に実行するためのカスタムフック
 */
export function useSupabaseMutation<TData, TResult = TData>(
  mutationFn: (data: TData) => Promise<{ data: TResult | null; error: PostgrestError | null }>,
  options?: {
    onSuccess?: (data: TResult) => void;
    onError?: (error: string) => void;
  }
) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
  }>({
    loading: false,
    error: null,
  });

  const mutate = useCallback(async (data: TData): Promise<TResult | null> => {
    setState({ loading: true, error: null });

    try {
      const { data: result, error } = await mutationFn(data);

      if (error) {
        const errorMessage = translateError(error);
        setState({ loading: false, error: errorMessage });
        options?.onError?.(errorMessage);
        return null;
      }

      setState({ loading: false, error: null });
      if (result) {
        options?.onSuccess?.(result);
      }
      return result;
    } catch (err) {
      const errorMessage = translateError(err);
      setState({ loading: false, error: errorMessage });
      options?.onError?.(errorMessage);
      return null;
    }
  }, [mutationFn, options]);

  const reset = useCallback(() => {
    setState({ loading: false, error: null });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}

/**
 * 複数のSupabaseクエリを並列実行するユーティリティ
 */
export async function executeParallel<T extends Record<string, () => Promise<{ data: unknown; error: PostgrestError | null }>>>(
  queries: T
): Promise<{
  results: { [K in keyof T]: Awaited<ReturnType<T[K]>>['data'] };
  errors: string[];
}> {
  const keys = Object.keys(queries) as (keyof T)[];
  const promises = keys.map(key => queries[key]());
  const results = await Promise.all(promises);

  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  keys.forEach((key, index) => {
    const result = results[index];
    if (result.error) {
      errors.push(`${String(key)}: ${translateError(result.error)}`);
    }
    data[key as string] = result.data;
  });

  return {
    results: data as { [K in keyof T]: Awaited<ReturnType<T[K]>>['data'] },
    errors,
  };
}
