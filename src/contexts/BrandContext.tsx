'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ブランド型定義
export type Brand = string;

// フォールバック用のデフォルトブランド（API接続できない場合）
const DEFAULT_BRANDS = ['TL', 'BE', 'AM'] as const;

interface BrandData {
  code: string;
  name: string;
  color?: string;
}

interface BrandContextType {
  currentBrand: Brand;
  setCurrentBrand: (brand: Brand) => void;
  brands: Brand[];
  brandData: BrandData[];
  isBrandSelected: boolean;
  clearBrandSelection: () => void;
  isLoading: boolean;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);
const BRAND_COOKIE_KEY = 'clout_brand';
const LEGACY_BRAND_COOKIE_KEY = 'clout_current_brand';

// キャッシュ設定
const CACHE_KEY = 'clout_brands_cache';
const CACHE_EXPIRY_KEY = 'clout_brands_cache_expiry';
const CACHE_DURATION = 60 * 60 * 1000; // 1時間

// 許可ブランド（SSO）のキャッシュ
const ALLOWED_BRANDS_CACHE_KEY = 'clout_allowed_brands_cache';
const ALLOWED_BRANDS_CACHE_EXPIRY_KEY = 'clout_allowed_brands_cache_expiry';
// 権限は運用で変わりうるため短め
const ALLOWED_BRANDS_CACHE_DURATION = 10 * 60 * 1000; // 10分

// キャッシュからブランドを取得
function getCachedBrands(): BrandData[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
    if (!expiry || Date.now() > parseInt(expiry, 10)) {
      return null; // キャッシュ期限切れ
    }

    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn('Failed to read brand cache:', error);
  }
  return null;
}

function getCachedAllowedBrands(): Brand[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const expiry = localStorage.getItem(ALLOWED_BRANDS_CACHE_EXPIRY_KEY);
    if (!expiry || Date.now() > parseInt(expiry, 10)) {
      return null;
    }
    const cached = localStorage.getItem(ALLOWED_BRANDS_CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    if (!Array.isArray(parsed)) return null;

    return parsed.map((b) => String(b).toUpperCase()) as Brand[];
  } catch {
    return null;
  }
}

function setCachedAllowedBrands(brands: Brand[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(ALLOWED_BRANDS_CACHE_KEY, JSON.stringify(brands));
    localStorage.setItem(
      ALLOWED_BRANDS_CACHE_EXPIRY_KEY,
      String(Date.now() + ALLOWED_BRANDS_CACHE_DURATION)
    );
  } catch {
    // ignore
  }
}

// ブランドをキャッシュに保存
function setCachedBrands(brands: BrandData[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(brands));
    localStorage.setItem(CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION));
  } catch (error) {
    console.warn('Failed to cache brands:', error);
  }
}

// Clout Master APIからブランドを取得（キャッシュ付き）
async function fetchBrandsFromClout(): Promise<BrandData[]> {
  // キャッシュを先にチェック
  const cached = getCachedBrands();
  if (cached) {
    return cached;
  }

  try {
    // same-origin proxy: /api/master/brands -> Clout Dashboard
    const response = await fetch('/api/master/brands');

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const brands = data.brands || DEFAULT_BRANDS.map(code => ({ code, name: code }));

    // キャッシュに保存
    setCachedBrands(brands);

    return brands;
  } catch (error) {
    console.error('Failed to fetch brands from Clout:', error);
    return DEFAULT_BRANDS.map(code => ({ code, name: code }));
  }
}

// Clout Authから許可ブランドを取得
async function fetchAllowedBrands(): Promise<Brand[]> {
  const cached = getCachedAllowedBrands();
  if (cached) return cached;

  try {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!response.ok) return [];

    const data = await response.json();
    const brands = Array.isArray(data?.brands) ? data.brands : [];
    const normalized = (brands as string[]).map((b) => String(b).toUpperCase()) as Brand[];
    setCachedAllowedBrands(normalized);
    return normalized;
  } catch (error) {
    console.warn('Failed to fetch allowed brands:', error);
    return [];
  }
}

function getCookieValue(name: string): string {
  if (typeof document === 'undefined') return '';
  const parts = String(document.cookie || '').split(';');
  let value = '';
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    if (k === name) value = rest.join('=');
  }
  return value;
}

function setBrandCookie(value: string | null): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const host = window.location.hostname;
  const domain =
    host === 'clout.co.jp' || host.endsWith('.clout.co.jp')
      ? '; Domain=clout.co.jp'
      : '';

  const clear = (key: string) => {
    document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    if (domain) {
      document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax${secure}${domain}`;
    }
  };

  if (!value) {
    clear(BRAND_COOKIE_KEY);
    clear(LEGACY_BRAND_COOKIE_KEY);
    return;
  }

  // Prefer a parent-domain cookie for cross-subdomain persistence, and delete any host-only cookie to avoid duplicates.
  document.cookie = `${BRAND_COOKIE_KEY}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}${domain}`;
  if (domain) {
    document.cookie = `${BRAND_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  }

  // Cleanup legacy keys to avoid drift.
  clear(LEGACY_BRAND_COOKIE_KEY);
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [currentBrand, setCurrentBrand] = useState<Brand>('TL');
  const [brandData, setBrandData] = useState<BrandData[]>([]);
  const [isBrandSelected, setIsBrandSelected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Clout APIからブランドを取得
  useEffect(() => {
    let isMounted = true;
    const loadBrands = async () => {
      const [cloutBrands, allowedBrands] = await Promise.all([
        fetchBrandsFromClout(),
        fetchAllowedBrands(),
      ]);

      let filtered = cloutBrands;
      if (allowedBrands.length > 0) {
        filtered = cloutBrands.filter(b => allowedBrands.includes(b.code as Brand));
        if (filtered.length === 0) {
          filtered = allowedBrands.map(code => ({ code, name: code }));
        }
      }

      if (isMounted) {
        setBrandData(filtered);
        setIsLoading(false);
      }
    };

    loadBrands();
    return () => {
      isMounted = false;
    };
  }, []);

  // Brand restore: cookie SSoT + URL param. Legacy localStorage is migrated once.
  useEffect(() => {
    const urlBrandParam = (() => {
      try {
        const url = new URL(window.location.href);
        return String(url.searchParams.get('brand') || '').trim().toUpperCase();
      } catch {
        return '';
      }
    })();

    const urlBrand =
      urlBrandParam === 'TL' || urlBrandParam === 'BE' || urlBrandParam === 'AM'
        ? (urlBrandParam as Brand)
        : '';

    // URLの brand= を処理したら除去（以降はアプリ内状態で保持）
    if (urlBrandParam) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('brand');
        window.history.replaceState({}, '', url.toString());
      } catch {
        // ignore
      }
    }

    // URLの brand= を最優先（クロスアプリでのブランド引き継ぎ）
    if (urlBrand && brandData.some((b) => b.code === urlBrand)) {
      setCurrentBrand(urlBrand);
      setIsBrandSelected(true);
      setBrandCookie(urlBrand);
      setIsInitialized(true);
      return;
    }

    // Cookie is the long-term cross-subdomain source of truth.
    const cookieBrandParam = (() => {
      try {
        return decodeURIComponent(getCookieValue(BRAND_COOKIE_KEY) || getCookieValue(LEGACY_BRAND_COOKIE_KEY) || '').trim().toUpperCase();
      } catch {
        return '';
      }
    })();
    const cookieBrand =
      cookieBrandParam === 'TL' || cookieBrandParam === 'BE' || cookieBrandParam === 'AM'
        ? (cookieBrandParam as Brand)
        : '';
    if (cookieBrand && brandData.some((b) => b.code === cookieBrand)) {
      setCurrentBrand(cookieBrand);
      setIsBrandSelected(true);
      setBrandCookie(cookieBrand);
      setIsInitialized(true);
      return;
    }

    // One-time migration: legacy localStorage -> cookie.
    try {
      const saved = String(localStorage.getItem('selectedBrand') || '').trim().toUpperCase();
      const isValid = saved && brandData.some((b) => b.code === saved);
      if (isValid) {
        setCurrentBrand(saved);
        setIsBrandSelected(true);
        setBrandCookie(saved);
        localStorage.removeItem('selectedBrand');
        localStorage.removeItem('brandSelected');
        setIsInitialized(true);
        return;
      }
    } catch {
      // ignore
    }

    if (brandData.length > 0) {
      const fallback = brandData[0].code as Brand;
      setCurrentBrand(fallback);
      // If only one brand is available, auto-select it (no extra clicks).
      const autoSelected = brandData.length === 1;
      setIsBrandSelected(autoSelected);
      if (autoSelected) {
        setBrandCookie(fallback);
      }
    }
    setIsInitialized(true);
  }, [brandData]);

  // Persist to cookie (cross-app SSoT).
  const handleSetBrand = (brand: Brand) => {
    setCurrentBrand(brand);
    setIsBrandSelected(true);
    setBrandCookie(brand);
  };

  // Always keep cookie in sync once initialized (long-term cross-subdomain SSoT).
  useEffect(() => {
    if (!isInitialized) return;
    if (!currentBrand) return;
    setBrandCookie(String(currentBrand).toUpperCase());
  }, [currentBrand, isInitialized]);

  // ブランド選択をクリア（ログアウト時などに使用）
  const clearBrandSelection = () => {
    setIsBrandSelected(false);
    setCurrentBrand('');
    setBrandCookie(null);
    try {
      localStorage.removeItem('selectedBrand');
      localStorage.removeItem('brandSelected');
    } catch {
      // ignore
    }
  };

  // 初期化完了まで待機（ローディングUIを表示）
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[oklch(0.145_0_0)]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">ブランド情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  const brands = brandData.map(b => b.code);

  return (
    <BrandContext.Provider value={{
      currentBrand,
      setCurrentBrand: handleSetBrand,
      brands,
      brandData,
      isBrandSelected,
      clearBrandSelection,
      isLoading,
    }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}

// 後方互換性のためのエクスポート（非推奨）
export const BRANDS = DEFAULT_BRANDS;
