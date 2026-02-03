'use client';

import { useRouter } from 'next/navigation';
import { useBrand, BRANDS, Brand } from '@/contexts/BrandContext';
import { ArrowRight } from 'lucide-react';

// ブランド情報
const BRAND_INFO: Record<Brand, {
  name: string;
  fullName: string;
  description: string;
  tagline: string;
}> = {
  TL: {
    name: 'TL',
    fullName: "That's life",
    description: 'カジュアル＆ストリート',
    tagline: '日常に寄り添うスタイル',
  },
  BE: {
    name: 'BE',
    fullName: 'Belvet',
    description: 'エレガント＆フェミニン',
    tagline: '洗練された大人の魅力',
  },
  AM: {
    name: 'AM',
    fullName: 'Antimid',
    description: 'モード＆アバンギャルド',
    tagline: '常識を超えるデザイン',
  },
};

export default function BrandSelectPage() {
  const router = useRouter();
  const { setCurrentBrand } = useBrand();

  const handleSelectBrand = (brand: Brand) => {
    setCurrentBrand(brand);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gray-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gray-200/30 rounded-full blur-3xl" />
      </div>

      {/* コンテンツ */}
      <div className="relative z-10 w-full max-w-5xl">
        {/* ヘッダー */}
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-100 mb-6">
            <div className="w-2 h-2 bg-gray-800 rounded-full animate-pulse" />
            <span className="text-sm text-gray-600 font-medium">Gifting Manager</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            ブランドを選択
          </h1>
          <p className="text-gray-500 text-lg">
            管理するブランドを選んでください
          </p>
        </div>

        {/* ブランド選択カード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {BRANDS.map((brand, index) => {
            const info = BRAND_INFO[brand];
            return (
              <button
                key={brand}
                onClick={() => handleSelectBrand(brand)}
                className="group relative bg-white rounded-3xl p-8 text-left
                         border border-gray-100 shadow-sm
                         transition-all duration-500 ease-out
                         hover:shadow-2xl hover:shadow-gray-200/50
                         hover:border-gray-300 hover:-translate-y-2
                         active:translate-y-0 active:shadow-lg
                         animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* ブランド名バッジ */}
                <div className="mb-8">
                  <span className="inline-flex items-center justify-center w-16 h-16
                                 bg-gray-50 rounded-2xl text-2xl font-bold text-gray-800
                                 group-hover:bg-gray-800 group-hover:text-white
                                 transition-all duration-300 ease-out
                                 group-hover:scale-110 group-hover:rotate-3">
                    {info.name}
                  </span>
                </div>

                {/* ブランド情報 */}
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">
                    {info.fullName}
                  </h2>
                  <p className="text-gray-500 text-sm font-medium">
                    {info.description}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {info.tagline}
                  </p>
                </div>

                {/* アクション */}
                <div className="mt-8 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
                    選択して開始
                  </span>
                  <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center
                                group-hover:bg-gray-800 transition-all duration-300">
                    <ArrowRight
                      size={18}
                      className="text-gray-400 group-hover:text-white
                               transform group-hover:translate-x-0.5 transition-all"
                    />
                  </div>
                </div>

                {/* ホバー時の装飾線 */}
                <div className="absolute bottom-0 left-8 right-8 h-1 bg-gray-800 rounded-full
                              scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              </button>
            );
          })}
        </div>

        {/* フッター */}
        <p className="mt-16 text-center text-sm text-gray-400 animate-fade-in" style={{ animationDelay: '400ms' }}>
          後からサイドバーで切り替えることもできます
        </p>
      </div>
    </div>
  );
}
