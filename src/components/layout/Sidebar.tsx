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
  Shield,
  BarChart3,
  Bell,
  History,
} from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useBrand, BRANDS, Brand } from '@/contexts/BrandContext';

// ブランドの色設定
const BRAND_COLORS: Record<Brand, {
  bg: string;
  bgActive: string;
  text: string;
  border: string;
}> = {
  TL: {
    bg: 'bg-emerald-100',
    bgActive: 'bg-emerald-800',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
  },
  BE: {
    bg: 'bg-gray-100',
    bgActive: 'bg-gray-600',
    text: 'text-gray-700',
    border: 'border-gray-300',
  },
  AM: {
    bg: 'bg-red-100',
    bgActive: 'bg-red-900',
    text: 'text-red-900',
    border: 'border-red-300',
  },
};

const navigation = [
  { name: 'ダッシュボード', href: '/dashboard', icon: LayoutDashboard },
  { name: 'ROI分析', href: '/analytics', icon: BarChart3 },
  { name: 'インフルエンサー', href: '/influencers', icon: Users },
  { name: 'ギフティング案件', href: '/campaigns', icon: Gift },
  { name: 'インポート', href: '/import', icon: Upload },
];

const settingsNavigation = [
  { name: '通知設定', href: '/notifications', icon: Bell },
  { name: '変更履歴', href: '/audit-log', icon: History },
  { name: '管理者', href: '/admin', icon: Shield },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currentBrand, setCurrentBrand } = useBrand();
  const colors = BRAND_COLORS[currentBrand];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const NavLink = ({ item, onClick }: { item: typeof navigation[0]; onClick?: () => void }) => {
    const isActive = pathname === item.href;
    return (
      <Link
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? `${colors.bgActive} text-white`
            : 'text-gray-600 hover:bg-gray-100'
        }`}
        onClick={onClick}
      >
        <item.icon size={18} />
        <span>{item.name}</span>
      </Link>
    );
  };

  return (
    <>
      {/* モバイルメニューボタン */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* オーバーレイ */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* ロゴ */}
          <div className="p-4 border-b">
            <h1 className="text-lg font-bold text-gray-800">Gifting Manager</h1>
          </div>

          {/* ブランド切り替え */}
          <div className="p-4 border-b">
            <p className="text-xs text-gray-500 mb-2">ブランド</p>
            <div className="flex gap-1">
              {BRANDS.map((brand) => {
                const brandColors = BRAND_COLORS[brand];
                const isActive = currentBrand === brand;
                return (
                  <button
                    key={brand}
                    onClick={() => setCurrentBrand(brand)}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                      isActive
                        ? `${brandColors.bgActive} text-white`
                        : `${brandColors.bg} ${brandColors.text} border ${brandColors.border}`
                    }`}
                  >
                    {brand}
                  </button>
                );
              })}
            </div>
            <p className={`mt-2 text-xs ${colors.text} text-center`}>
              {currentBrand === 'TL' && "That's life"}
              {currentBrand === 'BE' && 'Belvet'}
              {currentBrand === 'AM' && 'Antimid'}
            </p>
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

            <div className="pt-4 mt-4 border-t space-y-1">
              <p className="px-3 py-1 text-xs text-gray-400">設定</p>
              {settingsNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  item={item}
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              ))}
            </div>
          </nav>

          {/* ログアウト */}
          <div className="p-4 border-t">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
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
