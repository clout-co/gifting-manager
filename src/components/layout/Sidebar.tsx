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
  UserCog,
  RefreshCw,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useBrand, BRANDS, Brand } from '@/contexts/BrandContext';
import { ADMIN_EMAILS } from '@/types';

// ブランドの色設定（グレー系で統一）
const BRAND_COLORS: Record<Brand, {
  bg: string;
  bgActive: string;
  text: string;
  border: string;
}> = {
  TL: {
    bg: 'bg-gray-100',
    bgActive: 'bg-gray-800',
    text: 'text-gray-700',
    border: 'border-gray-300',
  },
  BE: {
    bg: 'bg-gray-100',
    bgActive: 'bg-gray-800',
    text: 'text-gray-700',
    border: 'border-gray-300',
  },
  AM: {
    bg: 'bg-gray-100',
    bgActive: 'bg-gray-800',
    text: 'text-gray-700',
    border: 'border-gray-300',
  },
};

const navigation = [
  { name: 'ダッシュボード', href: '/dashboard', icon: LayoutDashboard },
  { name: 'ROI分析', href: '/analytics', icon: BarChart3 },
  { name: 'インフルエンサー', href: '/influencers', icon: Users },
  { name: 'ギフティング案件', href: '/campaigns', icon: Gift },
  { name: 'インポート', href: '/import', icon: Upload },
];

// 一般ユーザー向け設定
const generalSettingsNavigation = [
  { name: '通知設定', href: '/notifications', icon: Bell },
  { name: '変更履歴', href: '/audit-log', icon: History },
];

// 管理者専用設定
const adminSettingsNavigation = [
  { name: '社員管理', href: '/staffs', icon: UserCog },
  { name: '管理者', href: '/admin', icon: Shield },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { currentBrand, setCurrentBrand, clearBrandSelection } = useBrand();
  const colors = BRAND_COLORS[currentBrand];

  // 管理者権限チェック
  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setIsAdmin(ADMIN_EMAILS.includes(user.email.toLowerCase()));
      }
    };
    checkAdminStatus();
  }, []);

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

          {/* 現在のブランド表示 */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">現在のブランド</p>
              <button
                onClick={handleChangeBrand}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
              >
                <RefreshCw size={12} />
                <span>変更</span>
              </button>
            </div>
            <div className={`${colors.bgActive} text-white px-4 py-3 rounded-lg text-center`}>
              <span className="text-lg font-bold">{currentBrand}</span>
              <p className="text-xs text-white/70 mt-1">
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

            <div className="pt-4 mt-4 border-t space-y-1">
              <p className="px-3 py-1 text-xs text-gray-400">設定</p>
              {generalSettingsNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  item={item}
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              ))}

              {/* 管理者専用メニュー */}
              {isAdmin && (
                <>
                  <p className="px-3 py-1 pt-3 text-xs text-gray-400 flex items-center gap-1">
                    <Shield size={12} />
                    管理者メニュー
                  </p>
                  {adminSettingsNavigation.map((item) => (
                    <NavLink
                      key={item.name}
                      item={item}
                      onClick={() => setIsMobileMenuOpen(false)}
                    />
                  ))}
                </>
              )}
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
