'use client';

import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import AIChatWidget from '@/components/ui/AIChatWidget';
import { useBrand, Brand } from '@/contexts/BrandContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

// ブランドごとの設定（シンプルなカラー）
const BRAND_CONFIG: Record<Brand, {
  name: string;
  bgColor: string;
  textColor: string;
  description: string;
}> = {
  TL: {
    name: 'TL',
    bgColor: 'bg-emerald-800',
    textColor: 'text-emerald-800',
    description: "That's life",
  },
  BE: {
    name: 'BE',
    bgColor: 'bg-gray-600',
    textColor: 'text-gray-600',
    description: 'Belvet',
  },
  AM: {
    name: 'AM',
    bgColor: 'bg-red-900',
    textColor: 'text-red-900',
    description: 'Antimid',
  },
};

export default function MainLayout({ children }: MainLayoutProps) {
  const { currentBrand } = useBrand();
  const brandConfig = BRAND_CONFIG[currentBrand];

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen pb-20 lg:pb-0">
        {/* シンプルなブランド表示バー */}
        <div className={`sticky top-0 z-30 ${brandConfig.bgColor}`}>
          <div className="px-4 lg:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold text-lg">{brandConfig.name}</span>
              <span className="text-white/70 text-sm">
                {brandConfig.description}
              </span>
            </div>
            <div className="text-white/50 text-xs">
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
