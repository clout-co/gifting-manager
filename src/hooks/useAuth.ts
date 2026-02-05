'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 現在のセッションを取得
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session fetch error:', error.message);
          setAuthError('セッションの取得に失敗しました');
          setUser(null);
          setLoading(false);
          router.push('/auth');
          return;
        }

        setUser(session?.user ?? null);
        setAuthError(null);
        setLoading(false);

        if (!session?.user) {
          router.push('/auth');
          return;
        }

        // ブランド選択ページと認証ページ以外で、ブランド未選択なら選択画面へ
        const brandSelected = localStorage.getItem('brandSelected') === 'true';
        if (!brandSelected && pathname !== '/brand-select' && pathname !== '/auth') {
          router.push('/brand-select');
        }
      } catch (err) {
        console.error('Unexpected auth error:', err);
        setAuthError('認証エラーが発生しました');
        setUser(null);
        setLoading(false);
        router.push('/auth');
      }
    };

    getSession();

    // 認証状態の変化を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setAuthError(null);
        if (!session?.user) {
          router.push('/auth');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, pathname]);

  return { user, loading, authError };
}
