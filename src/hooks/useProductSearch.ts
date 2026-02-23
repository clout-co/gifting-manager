'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  normalizeProductCodeInput,
  canonicalizeProductCode,
  buildProductSearchQueries,
} from '@/lib/product-code';
import { translateError } from '@/lib/toast';

export type MasterProduct = {
  id: string;
  product_code: string;
  product_name: string | null;
  cost: number | null;
  sale_date: string | null;
  brand: string;
};

interface UseProductSearchOptions {
  query: string;
  brand: string;
  enabled?: boolean;
  debounceMs?: number;
}

interface UseProductSearchResult {
  products: MasterProduct[];
  isLoading: boolean;
  error: string | null;
  errorStatus: number | null;
  errorReason: string;
  queryHint: string;
  selectProduct: (product: MasterProduct) => void;
  resolvedProduct: MasterProduct | null;
  resolvedProductCode: string;
  isResolved: boolean;
  hasCost: boolean;
  resetResolved: () => void;
}

const normalizeMasterSaleDate = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

export function useProductSearch(options: UseProductSearchOptions): UseProductSearchResult {
  const { query, brand, enabled = true, debounceMs = 250 } = options;

  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorReason, setErrorReason] = useState<string>('');
  const [queryHint, setQueryHint] = useState<string>('');
  const [resolvedProduct, setResolvedProduct] = useState<MasterProduct | null>(null);
  const [resolvedProductCode, setResolvedProductCode] = useState<string>('');
  const [resolvedProductHasCost, setResolvedProductHasCost] = useState(false);

  const canonicalQuery = canonicalizeProductCode(query);
  const isResolved =
    Boolean(canonicalQuery) &&
    Boolean(canonicalizeProductCode(resolvedProductCode)) &&
    canonicalQuery === canonicalizeProductCode(resolvedProductCode);
  const hasCost = isResolved && resolvedProductHasCost;

  // 品番検索（Product Master連携）
  useEffect(() => {
    if (!enabled) return;

    const q = normalizeProductCodeInput(query || '');
    if (q.length < 2) {
      setProducts([]);
      setIsLoading(false);
      setError(null);
      setErrorStatus(null);
      setErrorReason('');
      setQueryHint('');
      return;
    }

    const controller = new AbortController();
    const t = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      setErrorStatus(null);
      setErrorReason('');
      setQueryHint('');
      try {
        const queries = buildProductSearchQueries(q);
        const primary = queries[0] || q;

        const fetchOnce = async (searchQuery: string) => {
          const url = `/api/master/products?brand=${encodeURIComponent(brand)}&q=${encodeURIComponent(searchQuery)}&limit=20`;
          const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
          const data = await response.json().catch(() => null);
          return { response, data };
        };

        const first = await fetchOnce(primary);
        let response = first.response;
        let data = first.data;
        let productList = Array.isArray(data?.products) ? (data.products as MasterProduct[]) : [];

        // Fallback: 表記ゆれパターン検索
        const fallbackQuery = queries.find((qq) => qq !== primary);
        if (productList.length === 0 && fallbackQuery) {
          const second = await fetchOnce(fallbackQuery);
          if (second.response.ok) {
            const secondProducts = Array.isArray(second.data?.products) ? (second.data.products as MasterProduct[]) : [];
            if (secondProducts.length > 0) {
              setQueryHint(`${primary} -> ${fallbackQuery}`);
              productList = secondProducts;
              response = second.response;
              data = second.data;
            }
          }
        }

        if (!response.ok) {
          const dataError = data && typeof data.error === 'string' ? data.error : '';
          const dataReason = data && typeof data.reason === 'string' ? data.reason : '';
          const isProductMasterAuthRedirect = dataReason === 'product_master_auth_redirect';

          setErrorStatus(response.status);
          setErrorReason(dataReason);

          const fallback =
            response.status === 401
              ? (isProductMasterAuthRedirect
                  ? '品番連携の認証が切れています（再ログインしてください）'
                  : '認証が切れています（再ログインしてください）')
              : response.status === 403
                ? '権限がありません（ブランド権限を確認してください）'
                : `検索に失敗しました (${response.status})`;

          const technicalErrors = new Set(['auth_failed', 'unauthorized', 'Forbidden', 'Unauthorized']);
          const msg =
            (dataError && !technicalErrors.has(dataError) ? dataError : '') ||
            (dataReason ? `${fallback} (${dataReason})` : fallback);
          throw new Error(msg);
        }

        // De-dup by product_code
        const seen = new Set<string>();
        const deduped = productList.filter((p) => {
          const code = String(p?.product_code || '').trim();
          if (!code) return false;
          if (seen.has(code)) return false;
          seen.add(code);
          return true;
        });

        setProducts(deduped);

        // 完全一致時に自動解決
        const qCanon = canonicalizeProductCode(q);
        const exactMatches = deduped.filter((p) => canonicalizeProductCode(p.product_code) === qCanon);
        const exact = exactMatches.length === 1 ? exactMatches[0] : null;
        if (exact) {
          setResolvedProductCode(exact.product_code);
          setResolvedProductHasCost(typeof exact.cost === 'number');
          setResolvedProduct(exact);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setProducts([]);
        setError(translateError(err));
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [query, brand, enabled, debounceMs]);

  const selectProduct = useCallback((p: MasterProduct) => {
    setResolvedProductCode(p.product_code);
    setResolvedProductHasCost(typeof p.cost === 'number');
    setResolvedProduct(p);
  }, []);

  const resetResolved = useCallback(() => {
    setResolvedProductCode('');
    setResolvedProductHasCost(false);
    setResolvedProduct(null);
    setProducts([]);
  }, []);

  return {
    products,
    isLoading,
    error,
    errorStatus,
    errorReason,
    queryHint,
    selectProduct,
    resolvedProduct,
    resolvedProductCode,
    isResolved,
    hasCost,
    resetResolved,
  };
}
