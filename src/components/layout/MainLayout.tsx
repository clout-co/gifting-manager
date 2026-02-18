'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useBrand, Brand, isValidBrand } from '@/contexts/BrandContext';
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
    accentColor: 'text-green-700 dark:text-green-300',
    accentBg: 'bg-green-500/10 border-green-500/20 dark:bg-green-900/30 dark:border-green-700/40',
    description: "That's life",
  },
  BE: {
    name: 'BE',
    accentColor: 'text-gray-700 dark:text-gray-300',
    accentBg: 'bg-gray-500/10 border-gray-500/20 dark:bg-gray-500/20 dark:border-gray-500/30',
    description: 'Belvet',
  },
  AM: {
    name: 'AM',
    accentColor: 'text-red-700 dark:text-red-300',
    accentBg: 'bg-red-500/10 border-red-500/20 dark:bg-red-900/30 dark:border-red-700/40',
    description: 'Antimid',
  },
};

const DEFAULT_CONFIG = {
  name: '---',
  accentColor: 'text-muted-foreground',
  accentBg: 'bg-muted border-border',
  description: '',
};

export default function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentBrand, isBrandSelected } = useBrand();
  const { user } = useAuth();
  const brandConfig = (isValidBrand(currentBrand) && BRAND_CONFIG[currentBrand]) || DEFAULT_CONFIG;

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
    </div>
  );
}
