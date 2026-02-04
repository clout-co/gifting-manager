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
  BarChart3,
  RefreshCw,
  ExternalLink,
  Video,
  Camera,
  Package,
  Home,
  Sun,
  Moon,
  ListChecks,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useBrand, Brand } from '@/contexts/BrandContext';

// ブランドの色設定（ダークテーマ用）
const BRAND_COLORS: Record<Brand, {
  bg: string;
  bgActive: string;
  text: string;
  border: string;
  accent: string;
}> = {
  TL: {
    bg: 'bg-white/5',
    bgActive: 'bg-white/15',
    text: 'text-white',
    border: 'border-white/20',
    accent: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  BE: {
    bg: 'bg-white/5',
    bgActive: 'bg-white/15',
    text: 'text-white',
    border: 'border-white/20',
    accent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  AM: {
    bg: 'bg-white/5',
    bgActive: 'bg-white/15',
    text: 'text-white',
    border: 'border-white/20',
    accent: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
};

const navigation = [
  { name: 'ダッシュボード', href: '/dashboard', icon: LayoutDashboard },
  { name: 'ROI分析', href: '/analytics', icon: BarChart3 },
  { name: 'インフルエンサー', href: '/influencers', icon: Users },
  { name: 'ギフティング案件', href: '/campaigns', icon: Gift },
  { name: '一括入力', href: '/bulk-input', icon: ListChecks },
  { name: 'インポート', href: '/import', icon: Upload },
];

// 他アプリへのリンク
const externalApps = [
  {
    name: 'Clout Dashboard',
    href: 'https://clout-dashboard.vercel.app',
    icon: Home,
    description: '統合ポータル',
  },
  {
    name: 'ShortsOS',
    href: 'https://shorts-os-bi.vercel.app',
    icon: Video,
    description: '動画分析',
  },
  {
    name: 'ModelCRM',
    href: 'https://model-crm-app.vercel.app',
    icon: Camera,
    description: '撮影管理',
    tlOnly: true,
  },
  {
    name: 'Master',
    href: 'https://product-master-neon.vercel.app',
    icon: Package,
    description: '商品マスター',
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { currentBrand, clearBrandSelection } = useBrand();
  const colors = BRAND_COLORS[currentBrand];

  // ダークモード設定の初期化
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    setIsDarkMode(isDark);
    document.documentElement.classList.toggle('light-mode', !isDark);
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDarkMode;
    setIsDarkMode(newIsDark);
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('light-mode', !newIsDark);
  };

  const handleLogout = async () => {
    clearBrandSelection();
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const handleChangeBrand = () => {
    clearBrandSelection();
    router.push('/brand-select');
  };

  const NavLink = ({ item, onClick }: { item: typeof navigation[0]; onClick?: () => void }) => {
    const isActive = pathname === item.href;
    return (
      <Link
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
          isActive
            ? isDarkMode ? 'bg-white/15 text-white' : 'bg-gray-200 text-gray-900'
            : isDarkMode ? 'text-gray-400 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
        onClick={onClick}
      >
        <item.icon size={18} />
        <span>{item.name}</span>
      </Link>
    );
  };

  const ExternalAppLink = ({ app }: { app: typeof externalApps[0] }) => {
    // TL専用アプリはTL以外では非表示
    if (app.tlOnly && currentBrand !== 'TL') return null;

    return (
      <a
        href={app.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 group ${
          isDarkMode
            ? 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
      >
        <app.icon size={16} className={`${isDarkMode ? 'text-gray-600 group-hover:text-gray-400' : 'text-gray-400 group-hover:text-gray-600'}`} />
        <div className="flex-1 min-w-0">
          <span className="block truncate">{app.name}</span>
          <span className={`block text-xs truncate ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>{app.description}</span>
        </div>
        <ExternalLink size={12} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
      </a>
    );
  };

  return (
    <>
      {/* モバイルメニューボタン */}
      <button
        className={`lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl shadow-lg ${
          isDarkMode
            ? 'bg-[oklch(0.205_0_0)] border border-white/10'
            : 'bg-white border border-gray-200'
        }`}
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen
          ? <X size={20} className={isDarkMode ? 'text-white' : 'text-gray-900'} />
          : <Menu size={20} className={isDarkMode ? 'text-white' : 'text-gray-900'} />
        }
      </button>

      {/* オーバーレイ */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 z-50 transform transition-transform lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          isDarkMode
            ? 'bg-[oklch(0.165_0_0)] border-r border-white/10'
            : 'bg-white border-r border-gray-200'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* ロゴ */}
          <div className={`p-4 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
            <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Gifting Manager</h1>
            <p className="text-xs text-gray-500 mt-0.5">GGCRM</p>
          </div>

          {/* 現在のブランド表示 */}
          <div className={`p-4 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">現在のブランド</p>
              <button
                onClick={handleChangeBrand}
                className={`flex items-center gap-1 text-xs text-gray-500 transition-colors ${
                  isDarkMode ? 'hover:text-white' : 'hover:text-gray-900'
                }`}
              >
                <RefreshCw size={12} />
                <span>変更</span>
              </button>
            </div>
            <div className={`${colors.accent} border px-4 py-3 rounded-xl text-center`}>
              <span className="text-lg font-bold">{currentBrand}</span>
              <p className="text-xs opacity-70 mt-1">
                {currentBrand === 'TL' && "That's life"}
                {currentBrand === 'BE' && 'Belvet'}
                {currentBrand === 'AM' && 'Antimid'}
              </p>
            </div>
          </div>

          {/* メインナビ */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                item={item}
                onClick={() => setIsMobileMenuOpen(false)}
              />
            ))}

            {/* 他アプリへのリンク */}
            <div className={`pt-4 mt-4 border-t space-y-1 ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
              <p className="px-3 py-1 text-xs text-gray-500 flex items-center gap-1">
                <ExternalLink size={12} />
                他のアプリ
              </p>
              {externalApps.map((app) => (
                <ExternalAppLink key={app.name} app={app} />
              ))}
            </div>
          </nav>

          {/* ダークモード切り替え & ログアウト */}
          <div className={`p-4 border-t space-y-1 ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm transition-all duration-200 ${
                isDarkMode
                  ? 'text-gray-400 hover:bg-white/10 hover:text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              <span>{isDarkMode ? 'ライトモード' : 'ダークモード'}</span>
            </button>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm transition-all duration-200 ${
                isDarkMode
                  ? 'text-gray-400 hover:bg-white/10 hover:text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <LogOut size={18} />
              <span>ログアウト</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
