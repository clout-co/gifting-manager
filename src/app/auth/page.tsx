'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const CLOUT_AUTH_URL = process.env.NEXT_PUBLIC_CLOUT_AUTH_URL || 'https://dashboard.clout.co.jp';

/**
 * 認証ページ（リダイレクト専用）
 *
 * SSO強制化に伴い、ローカル認証は廃止されました（ADR-006）。
 * このページにアクセスしたユーザーはClout Dashboardにリダイレクトされます。
 */
export default function AuthPage() {
  const [fallbackHref, setFallbackHref] = useState(`${CLOUT_AUTH_URL}/sign-in`);

  useEffect(() => {
    // 現在のURLをリダイレクト先として設定
    const currentUrl = window.location.href;
    const rid = (() => {
      try {
        return crypto.randomUUID();
      } catch {
        return `${Date.now()}`;
      }
    })();
    const redirectUrl = `${CLOUT_AUTH_URL}/api/auth/redirect?app=gifting-app&redirect_url=${encodeURIComponent(currentUrl)}&rid=${encodeURIComponent(rid)}`;
    setFallbackHref(redirectUrl);
    window.location.href = redirectUrl;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center">
        <Loader2 className="animate-spin h-8 w-8 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Clout Dashboard にリダイレクト中...</p>
        <p className="text-sm text-muted-foreground mt-2">
          自動的にリダイレクトされない場合は{' '}
          <a
            href={fallbackHref}
            className="text-blue-600 hover:underline"
          >
            こちら
          </a>
          {' '}をクリックしてください
        </p>
      </div>
    </div>
  );
}
