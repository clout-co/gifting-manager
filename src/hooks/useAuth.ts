'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export type CloutUser = {
  id: string;
  email: string;
  name: string;
};

export function useAuth() {
  const [user, setUser] = useState<CloutUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!response.ok) {
          if (!cancelled) {
            setUser(null);
            setAuthError(null);
            setLoading(false);
          }
          if (pathname !== '/auth') {
            router.push('/auth');
          }
          return;
        }

        const data = await response.json();
        const u = data?.user as { id?: string; email?: string; name?: string } | undefined;
        if (!u?.id || !u?.email) {
          if (!cancelled) {
            setUser(null);
            setAuthError(null);
            setLoading(false);
          }
          if (pathname !== '/auth') {
            router.push('/auth');
          }
          return;
        }

        if (!cancelled) {
          setUser({ id: u.id, email: u.email, name: u.name || '' });
          setAuthError(null);
          setLoading(false);
        }

        // ブランド選択ページと認証ページ以外で、ブランド未選択なら選択画面へ
        const brandSelected = (() => {
          try {
            const parts = String(document.cookie || '').split(';');
            let raw = '';
            let legacy = '';
            for (const part of parts) {
              const [k, ...rest] = part.trim().split('=');
              if (!k) continue;
              if (k === 'clout_brand') raw = rest.join('=');
              if (k === 'clout_current_brand') legacy = rest.join('=');
            }
            const value = decodeURIComponent(raw || legacy || '').trim().toUpperCase();
            return value === 'TL' || value === 'BE' || value === 'AM';
          } catch {
            return false;
          }
        })();
        const urlBrandSelected = (() => {
          try {
            const url = new URL(window.location.href);
            const brand = String(url.searchParams.get('brand') || '').trim().toUpperCase();
            return brand === 'TL' || brand === 'BE' || brand === 'AM';
          } catch {
            return false;
          }
        })();
        if (!brandSelected && !urlBrandSelected && pathname !== '/brand-select' && pathname !== '/auth') {
          router.push('/brand-select');
        }
      } catch (err) {
        console.error('Unexpected auth error:', err);
        if (!cancelled) {
          setAuthError('認証エラーが発生しました');
          setUser(null);
          setLoading(false);
        }
        if (pathname !== '/auth') {
          router.push('/auth');
        }
      }
    };

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  return { user, loading, authError };
}
