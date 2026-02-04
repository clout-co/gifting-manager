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

// キャッシュ設定
const CACHE_KEY = 'clout_brands_cache';
const CACHE_EXPIRY_KEY = 'clout_brands_cache_expiry';
const CACHE_DURATION = 60 * 60 * 1000; // 1時間

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

  const apiUrl = process.env.NEXT_PUBLIC_CLOUT_API_URL;
  const apiKey = process.env.NEXT_PUBLIC_CLOUT_API_KEY;

  if (!apiUrl) {
    console.warn('CLOUT_API_URL not configured, using default brands');
    return DEFAULT_BRANDS.map(code => ({ code, name: code }));
  }

  try {
    const response = await fetch(`${apiUrl}/api/master/brands`, {
      headers: {
        'x-api-key': apiKey || '',
      },
    });

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

export function BrandProvider({ children }: { children: ReactNode }) {
  const [currentBrand, setCurrentBrand] = useState<Brand>('TL');
  const [brandData, setBrandData] = useState<BrandData[]>([]);
  const [isBrandSelected, setIsBrandSelected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Clout APIからブランドを取得
  useEffect(() => {
    fetchBrandsFromClout().then(data => {
      setBrandData(data);
      setIsLoading(false);
    });
  }, []);

  // ローカルストレージから復元
  useEffect(() => {
    const saved = localStorage.getItem('selectedBrand');
    const hasSelected = localStorage.getItem('brandSelected') === 'true';

    if (saved && brandData.some(b => b.code === saved)) {
      setCurrentBrand(saved);
    } else if (brandData.length > 0) {
      setCurrentBrand(brandData[0].code);
    }
    setIsBrandSelected(hasSelected);
    setIsInitialized(true);
  }, [brandData]);

  // ローカルストレージに保存
  const handleSetBrand = (brand: Brand) => {
    setCurrentBrand(brand);
    setIsBrandSelected(true);
    localStorage.setItem('selectedBrand', brand);
    localStorage.setItem('brandSelected', 'true');
  };

  // ブランド選択をクリア（ログアウト時などに使用）
  const clearBrandSelection = () => {
    setIsBrandSelected(false);
    localStorage.removeItem('brandSelected');
  };

  // 初期化完了まで待機
  if (!isInitialized || isLoading) {
    return null;
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
