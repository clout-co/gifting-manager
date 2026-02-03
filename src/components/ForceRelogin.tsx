'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// セッションリセットのバージョン - この値を変更すると全員再ログインになる
const SESSION_VERSION = '2026-02-02-v3';
const SESSION_VERSION_KEY = 'gifting_session_version';

export default function ForceRelogin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkSessionVersion = async () => {
      // 認証ページは除外
      if (pathname === '/auth') {
        setChecked(true);
        return;
      }

      const storedVersion = localStorage.getItem(SESSION_VERSION_KEY);

      // バージョンが異なる場合は強制ログアウト
      if (storedVersion !== SESSION_VERSION) {
        console.log('Session version mismatch, forcing re-login...');

        // ブランド選択をクリア（BrandContextで使用しているキー）
        localStorage.removeItem('selectedBrand');
        localStorage.removeItem('brandSelected');

        // Supabaseからログアウト
        await supabase.auth.signOut();

        // 新しいバージョンを保存
        localStorage.setItem(SESSION_VERSION_KEY, SESSION_VERSION);

        // 認証ページへリダイレクト
        router.push('/auth');
        return;
      }

      setChecked(true);
    };

    checkSessionVersion();
  }, [pathname, router]);

  // チェック中は何も表示しない（ちらつき防止）
  if (!checked && pathname !== '/auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
