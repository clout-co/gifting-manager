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
            // エラー時は3回リトライ
            retry: 3,
            // バックグラウンドでの再フェッチを有効化
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
