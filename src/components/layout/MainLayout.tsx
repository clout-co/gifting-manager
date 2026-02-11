'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import LazyAIChatWidget from '@/components/ui/LazyAIChatWidget';
import { useBrand, Brand } from '@/contexts/BrandContext';
import { useAuth } from '@/hooks/useAuth';

interface MainLayoutProps {
  children: React.ReactNode;
}

// ブランドごとの設定
const BRAND_CONFIG: Record<Brand, {
  name: string;
  accentColor: string;
  accentBg: string;
  description: string;
}> = {
  TL: {
    name: 'TL',
    accentColor: 'text-blue-600 dark:text-blue-400',
    accentBg: 'bg-blue-500/10 border-blue-500/20 dark:bg-blue-500/20 dark:border-blue-500/30',
    description: "That's life",
  },
  BE: {
    name: 'BE',
    accentColor: 'text-purple-600 dark:text-purple-400',
    accentBg: 'bg-purple-500/10 border-purple-500/20 dark:bg-purple-500/20 dark:border-purple-500/30',
    description: 'Belvet',
  },
  AM: {
    name: 'AM',
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    accentBg: 'bg-emerald-500/10 border-emerald-500/20 dark:bg-emerald-500/20 dark:border-emerald-500/30',
    description: 'Antimid',
  },
};

export default function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentBrand, isBrandSelected } = useBrand();
  const { user } = useAuth();
  const brandConfig = BRAND_CONFIG[currentBrand];

  // ブランドが選択されていない場合、ブランド選択画面にリダイレクト
  useEffect(() => {
    if (!isBrandSelected && pathname !== '/brand-select' && pathname !== '/auth') {
      router.push('/brand-select');
    }
  }, [isBrandSelected, pathname, router]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen pb-20 lg:pb-0">
        {/* ヘッダー - ModelCRM style */}
        <header className="sticky top-0 z-30 h-14 border-b bg-card flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <span className={`${brandConfig.accentBg} border px-3 py-1 rounded-lg font-bold text-sm ${brandConfig.accentColor}`}>
              {brandConfig.name}
            </span>
            <span className="text-sm text-muted-foreground hidden sm:block">
              {brandConfig.description}
            </span>
          </div>
          <span className="text-sm text-muted-foreground hidden sm:block">
            {user?.email}
          </span>
        </header>

        <div className="container mx-auto p-4 lg:p-6">{children}</div>
      </main>

      <BottomNav />
      <LazyAIChatWidget />
    </div>
  );
}
