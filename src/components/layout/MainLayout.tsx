'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import AIChatWidget from '@/components/ui/AIChatWidget';
import { useBrand, Brand } from '@/contexts/BrandContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

// ブランドごとの設定（ダークテーマ + アクセントカラー）
const BRAND_CONFIG: Record<Brand, {
  name: string;
  accentColor: string;
  accentBg: string;
  description: string;
}> = {
  TL: {
    name: 'TL',
    accentColor: 'text-emerald-400',
    accentBg: 'bg-emerald-500/20 border-emerald-500/30',
    description: "That's life",
  },
  BE: {
    name: 'BE',
    accentColor: 'text-blue-400',
    accentBg: 'bg-blue-500/20 border-blue-500/30',
    description: 'Belvet',
  },
  AM: {
    name: 'AM',
    accentColor: 'text-purple-400',
    accentBg: 'bg-purple-500/20 border-purple-500/30',
    description: 'Antimid',
  },
};

export default function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentBrand, isBrandSelected } = useBrand();
  const brandConfig = BRAND_CONFIG[currentBrand];
  const [isDarkMode, setIsDarkMode] = useState(true);

  // ダークモード設定の監視
  useEffect(() => {
    const checkTheme = () => {
      const isLight = document.documentElement.classList.contains('light-mode');
      setIsDarkMode(!isLight);
    };

    checkTheme();

    // MutationObserverでclass変更を監視
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // ブランドが選択されていない場合、ブランド選択画面にリダイレクト
  useEffect(() => {
    if (!isBrandSelected && pathname !== '/brand-select' && pathname !== '/auth') {
      router.push('/brand-select');
    }
  }, [isBrandSelected, pathname, router]);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDarkMode ? 'bg-[oklch(0.145_0_0)]' : 'bg-gray-50'
    }`}>
      <Sidebar />
      <main className="lg:ml-64 min-h-screen pb-20 lg:pb-0">
        {/* ブランド表示バー */}
        <div className={`sticky top-0 z-30 backdrop-blur-sm transition-colors duration-300 ${
          isDarkMode
            ? 'bg-[oklch(0.18_0_0)] border-b border-white/10'
            : 'bg-white/80 border-b border-gray-200'
        }`}>
          <div className="px-4 lg:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`${brandConfig.accentBg} border px-3 py-1 rounded-lg font-bold text-sm ${brandConfig.accentColor}`}>
                {brandConfig.name}
              </span>
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {brandConfig.description}
              </span>
            </div>
            <div className={`text-xs ${isDarkMode ? 'text-gray-600' : 'text-gray-500'}`}>
              {brandConfig.name} のデータを表示中
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6">{children}</div>
      </main>

      <BottomNav />
      <AIChatWidget />
    </div>
  );
}
