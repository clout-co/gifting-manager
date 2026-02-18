'use client';

import { useRouter } from 'next/navigation';
import { useBrand, Brand, isValidBrand } from '@/contexts/BrandContext';
import { ArrowRight } from 'lucide-react';

// ブランド情報
const BRAND_INFO: Record<Brand, {
  name: string;
  fullName: string;
  cardClass: string;
  shadowClass: string;
  badgeClass: string;
  badgeHoverClass: string;
  actionClass: string;
  actionHoverClass: string;
  actionIconClass: string;
  actionIconHoverClass: string;
  underlineClass: string;
}> = {
  TL: {
    name: 'TL',
    fullName: "That's life",
    cardClass: 'border-green-200/80 hover:border-green-900/40',
    shadowClass: 'hover:shadow-green-900/15',
    badgeClass: 'bg-green-100 text-green-900',
    badgeHoverClass: 'group-hover:bg-green-900 group-hover:text-white',
    actionClass: 'bg-green-100',
    actionHoverClass: 'group-hover:bg-green-900',
    actionIconClass: 'text-green-700',
    actionIconHoverClass: 'group-hover:text-white',
    underlineClass: 'bg-green-900',
  },
  BE: {
    name: 'BE',
    fullName: 'Belvet',
    cardClass: 'border-gray-300/80 hover:border-gray-600/40',
    shadowClass: 'hover:shadow-gray-500/20',
    badgeClass: 'bg-gray-200 text-gray-800',
    badgeHoverClass: 'group-hover:bg-gray-600 group-hover:text-white',
    actionClass: 'bg-gray-200',
    actionHoverClass: 'group-hover:bg-gray-600',
    actionIconClass: 'text-gray-700',
    actionIconHoverClass: 'group-hover:text-white',
    underlineClass: 'bg-gray-600',
  },
  AM: {
    name: 'AM',
    fullName: 'Antimid',
    cardClass: 'border-red-200/80 hover:border-red-900/40',
    shadowClass: 'hover:shadow-red-900/15',
    badgeClass: 'bg-red-100 text-red-900',
    badgeHoverClass: 'group-hover:bg-red-900 group-hover:text-white',
    actionClass: 'bg-red-100',
    actionHoverClass: 'group-hover:bg-red-900',
    actionIconClass: 'text-red-700',
    actionIconHoverClass: 'group-hover:text-white',
    underlineClass: 'bg-red-900',
  },
};

export default function BrandSelectPage() {
  const router = useRouter();
  const { setCurrentBrand, brands } = useBrand();

  const handleSelectBrand = (brand: string) => {
    if (!isValidBrand(brand)) return;
    setCurrentBrand(brand);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-muted/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-muted/30 rounded-full blur-3xl" />
      </div>

      {/* コンテンツ */}
      <div className="relative z-10 w-full max-w-5xl">
        {/* ヘッダー */}
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-100 mb-6">
            <div className="w-2 h-2 bg-gray-800 rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground font-medium">Gifting Manager</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            ブランドを選択
          </h1>
          <p className="text-muted-foreground text-lg">
            管理するブランドを選んでください
          </p>
        </div>

        {/* ブランド選択カード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {brands.map((brand, index) => {
            const info = (isValidBrand(brand) && BRAND_INFO[brand]) || {
              name: brand,
              fullName: brand,
              cardClass: 'border-gray-200 hover:border-border',
              shadowClass: 'hover:shadow-gray-200/50',
              badgeClass: 'bg-muted text-gray-800',
              badgeHoverClass: 'group-hover:bg-gray-800 group-hover:text-white',
              actionClass: 'bg-muted',
              actionHoverClass: 'group-hover:bg-gray-800',
              actionIconClass: 'text-muted-foreground',
              actionIconHoverClass: 'group-hover:text-white',
              underlineClass: 'bg-gray-800',
            };
            return (
              <button
                key={brand}
                onClick={() => handleSelectBrand(brand)}
                className={`group relative bg-white rounded-3xl p-8 text-left
                         border shadow-sm
                         transition-all duration-500 ease-out
                         hover:shadow-2xl hover:-translate-y-2
                         active:translate-y-0 active:shadow-lg
                         animate-slide-up ${info.cardClass} ${info.shadowClass}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* ブランド名バッジ */}
                <div className="mb-8">
                  <span className={`inline-flex items-center justify-center w-16 h-16
                                 rounded-2xl text-2xl font-bold
                                 transition-all duration-300 ease-out
                                 group-hover:scale-110 group-hover:rotate-3 ${info.badgeClass} ${info.badgeHoverClass}`}>
                    {info.name}
                  </span>
                </div>

                {/* ブランド情報 */}
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold text-foreground tracking-tight">
                    {info.fullName}
                  </h2>
                </div>

                {/* アクション */}
                <div className="mt-8 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-muted-foreground transition-colors">
                    選択して開始
                  </span>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center
                                transition-all duration-300 ${info.actionClass} ${info.actionHoverClass}`}>
                    <ArrowRight
                      size={18}
                      className={`transform group-hover:translate-x-0.5 transition-all
                               ${info.actionIconClass} ${info.actionIconHoverClass}`}
                    />
                  </div>
                </div>

                {/* ホバー時の装飾線 */}
                <div className={`absolute bottom-0 left-8 right-8 h-1 rounded-full
                              scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left ${info.underlineClass}`} />
              </button>
            );
          })}
        </div>

        {/* フッター */}
        <p className="mt-16 text-center text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '400ms' }}>
          後からサイドバーで切り替えることもできます
        </p>
      </div>
    </div>
  );
}
