'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Gift,
  LogOut,
  Menu,
  X,
  RefreshCw,
  ExternalLink,
  Video,
  Camera,
  Package,
  Target,
  ArrowLeft,
  ListChecks,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBrand, Brand, isValidBrand } from '@/contexts/BrandContext';
import { CLOUT_AUTH_URL, cloutLogout } from '@/lib/clout-auth';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type MasterApp = {
  id: string;
  name?: string;
  description?: string;
  url?: string;
  icon?: string;
  color?: string;
};

type MasterAppsResponse = {
  apps?: MasterApp[];
};

type ExternalApp = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  description: string;
  appSlug: string;
  tlOnly?: boolean;
};

// ブランドの色設定
const BRAND_COLORS: Record<Brand, {
  accent: string;
}> = {
  TL: { accent: 'bg-green-500/10 text-green-700 border-green-500/20 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/40' },
  BE: { accent: 'bg-gray-500/10 text-gray-700 border-gray-500/20 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/30' },
  AM: { accent: 'bg-red-500/10 text-red-700 border-red-500/20 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/40' },
};

const navigation = [
  { name: 'ダッシュボード', href: '/dashboard', icon: LayoutDashboard },
  { name: '要入力キュー', href: '/queue', icon: ListTodo },
  { name: 'インフルエンサー', href: '/influencers', icon: Users },
  { name: 'ギフティング案件', href: '/campaigns', icon: Gift },
  { name: '一括入力', href: '/bulk-input', icon: ListChecks },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { actualTheme, setTheme } = useTheme();
  const isDarkMode = actualTheme === 'dark';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [externalApps, setExternalApps] = useState<ExternalApp[]>([]);
  const [allowedApps, setAllowedApps] = useState<string[] | null>(null);
  const { currentBrand, brands: allowedBrands, clearBrandSelection } = useBrand();
  const DEFAULT_ACCENT = { accent: 'bg-muted text-foreground border-border' };
  const colors = (isValidBrand(currentBrand) && BRAND_COLORS[currentBrand]) || DEFAULT_ACCENT;
  const hasTLTeam = allowedBrands.includes('TL');
  const APP_ICON_MAP: Record<string, typeof LayoutDashboard> = { Package, Gift, Video, Target };

  // App Registry (single source): /api/master/apps -> Clout Dashboard
  useEffect(() => {
    let cancelled = false;

    const loadApps = async () => {
      try {
        const [appsRes, meRes] = await Promise.all([
          fetch('/api/master/apps', { cache: 'no-store' }),
          fetch('/api/auth/me', { cache: 'no-store' }),
        ]);

        let nextAllowedApps: string[] | null = null;
        if (meRes.ok) {
          const meJson = (await meRes.json().catch(() => null)) as { apps?: unknown } | null;
          const list = Array.isArray(meJson?.apps) ? meJson?.apps : [];
          const normalized = list.map((a) => String(a || '').trim()).filter(Boolean);
          nextAllowedApps = normalized.length > 0 ? normalized : null;
          if (!cancelled) setAllowedApps(nextAllowedApps);
        }

        if (!appsRes.ok) return;
        const data = (await appsRes.json().catch(() => null)) as MasterAppsResponse | null;
        const apps: MasterApp[] = Array.isArray(data?.apps) ? (data?.apps as MasterApp[]) : [];

        const mapped: ExternalApp[] = apps
          .filter((app): app is MasterApp => Boolean(app && typeof app.id === 'string' && typeof app.url === 'string'))
          .filter((app) => app.id !== 'gifting-app')
          .filter((app) => !nextAllowedApps || nextAllowedApps.includes(app.id))
          .map((app) => {
            const iconName = String(app.icon || '');
            const Icon = APP_ICON_MAP[iconName] || Package;
            return {
              name: String(app.name || app.id),
              href: String(app.url || ''),
              icon: Icon,
              description: String(app.description || ''),
              appSlug: String(app.id),
              tlOnly: String(app.id) === 'model-crm',
            };
          })
          .filter((app) => Boolean(app.href));

        if (!cancelled) setExternalApps(mapped);
      } catch {
        // ignore
      }
    };

    loadApps();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTheme = () => {
    setTheme(isDarkMode ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    clearBrandSelection();
    cloutLogout();
  };

  const handleChangeBrand = () => {
    clearBrandSelection();
    router.push('/brand-select');
  };

  const openInNewTab = (url: string) => {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (opened) {
      opened.opener = null;
      return;
    }
    window.location.href = url;
  };

  const openViaCloutRedirect = (redirectUrl: string, appSlug: string) => {
    const redirectWithBrand = (() => {
      if (!currentBrand) return redirectUrl;
      try {
        const url = new URL(redirectUrl);
        url.searchParams.set('brand', String(currentBrand).toUpperCase());
        url.searchParams.set('theme', isDarkMode ? 'dark' : 'light');
        return url.toString();
      } catch {
        return redirectUrl;
      }
    })();
    if (appSlug === 'clout-dashboard') {
      window.location.href = redirectWithBrand;
      return;
    }
    const url = `${CLOUT_AUTH_URL}/api/auth/redirect?redirect_url=${encodeURIComponent(redirectWithBrand)}&app=${encodeURIComponent(appSlug)}`;
    openInNewTab(url);
  };

  const dashboardUrl = (() => {
    try {
      const url = new URL(`${CLOUT_AUTH_URL}/dashboard`);
      url.searchParams.set('brand', String(currentBrand).toUpperCase());
      url.searchParams.set('theme', isDarkMode ? 'dark' : 'light');
      return url.toString();
    } catch {
      return `${CLOUT_AUTH_URL}/dashboard`;
    }
  })();

  const sidebarContent = (
    <>
      {/* Clout Dashboardへ戻るリンク */}
      <a
        href={dashboardUrl}
        className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border-b"
      >
        <ArrowLeft className="h-3 w-3" />
        Clout Dashboardへ戻る
      </a>

      {/* ロゴ - ModelCRM style */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Gifting CRM
          </span>
        </Link>
      </div>

      {/* 現在のブランド表示 */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">現在のブランド</p>
          <button
            onClick={handleChangeBrand}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
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

      {/* ナビゲーション - ModelCRM style */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <item.icon
                className={cn(
                  'h-5 w-5 transition-transform duration-200',
                  !isActive && 'group-hover:scale-110'
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* 連携システム */}
      {externalApps.length > 0 && (
        <div className="border-t px-3 py-4">
          <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            連携システム
          </p>
          {externalApps.map((app) => {
            const disabled = Boolean(app.tlOnly && !hasTLTeam);
            return (
              <button
                key={app.appSlug}
                type="button"
                disabled={disabled}
                onClick={() => openViaCloutRedirect(app.href, app.appSlug)}
                title={disabled ? 'TL チームのみアクセス可能' : undefined}
                className={cn(
                  'w-full text-left flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                  disabled
                    ? 'text-muted-foreground/50 cursor-not-allowed opacity-60'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <app.icon className="h-4 w-4" />
                {app.name}
                {!disabled && (
                  <ExternalLink size={12} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* テーマ & ログアウト */}
      <div className="border-t p-3 space-y-1">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm text-muted-foreground">テーマ</span>
          <button
            onClick={toggleTheme}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isDarkMode ? 'ライト' : 'ダーク'}
          </button>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          ログアウト
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* モバイルメニューボタン */}
      <button
        className="lg:hidden fixed top-3 left-4 z-50 p-2 rounded-xl shadow-sm bg-card border"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen
          ? <X size={20} className="text-foreground" />
          : <Menu size={20} className="text-foreground" />
        }
      </button>

      {/* オーバーレイ */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-64 z-50 transform transition-transform lg:translate-x-0 flex flex-col bg-card border-r',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
