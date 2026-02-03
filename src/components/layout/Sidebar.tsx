'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Gift,
  Upload,
  LogOut,
  Menu,
  X,
  Settings,
  Shield,
  ChevronRight,
  Sparkles,
  BarChart3,
  FileText,
  Bell,
  History,
  Building2,
} from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ThemeToggleSimple } from '@/components/ThemeProvider';
import { useBrand, BRANDS, Brand } from '@/contexts/BrandContext';

// ブランドの色設定
const BRAND_COLORS: Record<Brand, { bg: string; text: string; border: string; active: string }> = {
  TL: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', active: 'from-blue-500 to-blue-600' },
  BE: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', active: 'from-emerald-500 to-emerald-600' },
  AM: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', active: 'from-rose-500 to-rose-600' },
};

const navigation = [
  { name: 'ダッシュボード', href: '/dashboard', icon: LayoutDashboard, color: 'text-blue-500' },
  { name: 'ROI分析', href: '/analytics', icon: BarChart3, color: 'text-green-500' },
  { name: 'インフルエンサー', href: '/influencers', icon: Users, color: 'text-purple-500' },
  { name: 'ギフティング案件', href: '/campaigns', icon: Gift, color: 'text-pink-500' },
  { name: 'レポート', href: '/reports', icon: FileText, color: 'text-indigo-500' },
  { name: 'インポート', href: '/import', icon: Upload, color: 'text-cyan-500' },
];

const adminNavigation = [
  { name: '通知設定', href: '/notifications', icon: Bell, color: 'text-amber-500' },
  { name: '変更履歴', href: '/audit-log', icon: History, color: 'text-slate-500' },
  { name: '管理者', href: '/admin', icon: Shield, color: 'text-orange-500' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currentBrand, setCurrentBrand } = useBrand();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const NavLink = ({ item, onClick }: { item: typeof navigation[0]; onClick?: () => void }) => {
    const isActive = pathname === item.href;
    return (
      <Link
        href={item.href}
        className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
          isActive
            ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
        onClick={onClick}
      >
        <div className={`p-2 rounded-lg transition-all duration-300 ${
          isActive
            ? 'bg-white/20'
            : `bg-gray-100 group-hover:bg-gray-200 ${item.color}`
        }`}>
          <item.icon size={18} className={isActive ? 'text-white' : ''} />
        </div>
        <span className="font-medium flex-1">{item.name}</span>
        {isActive && (
          <ChevronRight size={16} className="opacity-70" />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* モバイルメニューボタン */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-3 rounded-xl bg-white/80 backdrop-blur-sm shadow-lg border border-gray-200/50 transition-all duration-300 hover:shadow-xl"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* オーバーレイ */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-white/80 backdrop-blur-xl shadow-2xl shadow-gray-200/50 transform transition-all duration-500 z-50 lg:translate-x-0 border-r border-gray-100/50 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* ロゴ */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl shadow-lg shadow-primary-500/30">
                <Sparkles className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">
                  Gifting Manager
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">インフルエンサー管理</p>
              </div>
            </div>
          </div>

          {/* ブランド切り替え - 大きく目立つように */}
          <div className={`px-4 py-4 border-b-2 ${BRAND_COLORS[currentBrand].border} bg-gradient-to-r ${BRAND_COLORS[currentBrand].bg} transition-all duration-300`}>
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={16} className={BRAND_COLORS[currentBrand].text} />
              <span className={`text-xs font-bold uppercase tracking-wider ${BRAND_COLORS[currentBrand].text}`}>
                ブランド選択
              </span>
            </div>
            <div className="flex gap-2">
              {BRANDS.map((brand) => {
                const colors = BRAND_COLORS[brand];
                const isActive = currentBrand === brand;
                return (
                  <button
                    key={brand}
                    onClick={() => setCurrentBrand(brand)}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                      isActive
                        ? `bg-gradient-to-r ${colors.active} text-white shadow-lg scale-105 ring-2 ring-white`
                        : `bg-white ${colors.text} border-2 ${colors.border} hover:shadow-md hover:scale-102`
                    }`}
                  >
                    {brand}
                  </button>
                );
              })}
            </div>
            {/* 選択中ブランドの説明 */}
            <div className={`mt-3 text-xs ${BRAND_COLORS[currentBrand].text} text-center font-medium`}>
              {currentBrand === 'TL' && "👑 That's life"}
              {currentBrand === 'BE' && '🌏 Belvet（海外発送対応）'}
              {currentBrand === 'AM' && '💎 Antimid'}
            </div>
          </div>

          {/* メインナビゲーション */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              メニュー
            </p>
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                item={item}
                onClick={() => setIsMobileMenuOpen(false)}
              />
            ))}

            <div className="pt-4 mt-4 border-t border-gray-100">
              <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                設定
              </p>
              {adminNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  item={item}
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              ))}
            </div>
          </nav>

          {/* ユーザー情報 & ログアウト */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800 dark:to-gray-700/50 rounded-xl">
              <div>
                <p className="text-xs text-gray-400">ログイン中</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">@clout.co.jp</p>
              </div>
              <ThemeToggleSimple />
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 w-full transition-all duration-300 group"
            >
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-red-100 dark:group-hover:bg-red-900/50 transition-colors">
                <LogOut size={18} />
              </div>
              <span className="font-medium">ログアウト</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
