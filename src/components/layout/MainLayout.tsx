'use client';

import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import AIChatWidget from '@/components/ui/AIChatWidget';
import { useBrand, Brand } from '@/contexts/BrandContext';
import { Building2, Globe } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

// ブランドごとの設定
const BRAND_CONFIG: Record<Brand, {
  name: string;
  gradient: string;
  bgGradient: string;
  accentColor: string;
  borderColor: string;
  description: string;
}> = {
  TL: {
    name: 'TL',
    gradient: 'from-blue-500 to-blue-600',
    bgGradient: 'from-blue-50/50 via-white to-blue-50/30',
    accentColor: 'bg-blue-500',
    borderColor: 'border-blue-200',
    description: "That's life",
  },
  BE: {
    name: 'BE',
    gradient: 'from-emerald-500 to-teal-600',
    bgGradient: 'from-emerald-50/50 via-white to-emerald-50/30',
    accentColor: 'bg-emerald-500',
    borderColor: 'border-emerald-200',
    description: 'Belvet（海外発送対応）',
  },
  AM: {
    name: 'AM',
    gradient: 'from-rose-500 to-pink-600',
    bgGradient: 'from-rose-50/50 via-white to-rose-50/30',
    accentColor: 'bg-rose-500',
    borderColor: 'border-rose-200',
    description: 'Antimid',
  },
};

export default function MainLayout({ children }: MainLayoutProps) {
  const { currentBrand } = useBrand();
  const brandConfig = BRAND_CONFIG[currentBrand];

  return (
    <div className={`min-h-screen bg-gradient-to-br ${brandConfig.bgGradient} dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 transition-colors duration-500`}>
      {/* 背景デコレーション - ブランドカラーを反映 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-80 h-80 ${
          currentBrand === 'TL' ? 'bg-blue-200/30' :
          currentBrand === 'BE' ? 'bg-emerald-200/30' :
          'bg-rose-200/30'
        } dark:opacity-20 rounded-full blur-3xl transition-colors duration-500`} />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-200/30 dark:bg-purple-900/20 rounded-full blur-3xl" />
        <div className={`absolute -bottom-40 right-1/3 w-80 h-80 ${
          currentBrand === 'TL' ? 'bg-blue-200/20' :
          currentBrand === 'BE' ? 'bg-teal-200/20' :
          'bg-pink-200/20'
        } dark:opacity-10 rounded-full blur-3xl transition-colors duration-500`} />
      </div>

      <Sidebar />
      <main className="lg:ml-72 min-h-screen relative pb-20 lg:pb-0">
        {/* ブランド表示バー */}
        <div className={`sticky top-0 z-30 bg-gradient-to-r ${brandConfig.gradient} shadow-lg`}>
          <div className="px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <Building2 size={16} className="text-white" />
                <span className="text-white font-bold text-lg">{brandConfig.name}</span>
              </div>
              <span className="text-white/80 text-sm hidden sm:block">
                {brandConfig.description}
              </span>
              {currentBrand === 'BE' && (
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs text-white">
                  <Globe size={12} />
                  <span>海外発送</span>
                </div>
              )}
            </div>
            <div className="text-white/60 text-xs hidden md:block">
              現在 <span className="font-bold text-white">{brandConfig.name}</span> のデータを表示中
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-8 animate-fade-in">{children}</div>
      </main>

      {/* モバイル用ボトムナビゲーション */}
      <BottomNav />

      {/* AIチャットウィジェット */}
      <AIChatWidget />
    </div>
  );
}
