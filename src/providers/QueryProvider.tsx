'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // データは5分間キャッシュ
            staleTime: 5 * 60 * 1000,
            // キャッシュは30分間保持
            gcTime: 30 * 60 * 1000,
            // 認証エラー(AuthError)はリトライしない、それ以外は2回
            retry: (failureCount, error) => {
              if (error && 'name' in error && error.name === 'AuthError') return false;
              return failureCount < 2;
            },
            // バックグラウンドでの再フェッチを有効化
            refetchOnWindowFocus: true,
            // オフライン→オンライン復帰時に再フェッチ
            refetchOnReconnect: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
