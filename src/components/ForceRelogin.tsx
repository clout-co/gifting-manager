'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cloutLogout } from '@/lib/clout-auth';

// セッションリセットのバージョン - この値を変更すると全員再ログインになる
const SESSION_VERSION = '2026-02-02-v3';
const SESSION_VERSION_KEY = 'gifting_session_version';

const IS_E2E =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_E2E === 'true';

export default function ForceRelogin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (IS_E2E) {
      setChecked(true);
      return;
    }

    const checkSessionVersion = async () => {
      // 認証ページは除外
      if (pathname === '/auth') {
        setChecked(true);
        return;
      }

      const storedVersion = localStorage.getItem(SESSION_VERSION_KEY);

      // バージョンが異なる場合は強制ログアウト
      if (storedVersion !== SESSION_VERSION) {
        // ブランド選択をクリア（BrandContextで使用しているキー）
        localStorage.removeItem('selectedBrand');
        localStorage.removeItem('brandSelected');
        // User-scoped caches (avoid stale permission/brand filters after forced relogin)
        localStorage.removeItem('clout_allowed_brands_cache');
        localStorage.removeItem('clout_allowed_brands_cache_expiry');

        // 新しいバージョンを保存
        localStorage.setItem(SESSION_VERSION_KEY, SESSION_VERSION);

        // Clout SSOログアウト（Clout Dashboardへリダイレクト）
        cloutLogout();
        return;
      }

      setChecked(true);
    };

    checkSessionVersion();
  }, [pathname]);

  // チェック中は何も表示しない（ちらつき防止）
  if (!checked && pathname !== '/auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-border border-t-gray-800 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-muted-foreground text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
