import {
  CreditCard,
  Gift,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type AppNavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  mobileLabel?: string;
  showInBottomNav?: boolean;
  activeMatch?: string[];
};

export const APP_NAVIGATION: AppNavigationItem[] = [
  {
    href: '/dashboard',
    label: 'ダッシュボード',
    mobileLabel: 'ホーム',
    icon: LayoutDashboard,
    showInBottomNav: true,
  },
  {
    href: '/queue',
    label: '要入力キュー',
    icon: ListTodo,
  },
  {
    href: '/influencers',
    label: 'インフルエンサー',
    icon: Users,
    showInBottomNav: true,
    activeMatch: ['/influencers'],
  },
  {
    href: '/campaigns',
    label: 'ギフティング案件',
    mobileLabel: '案件',
    icon: Gift,
    showInBottomNav: true,
  },
  {
    href: '/bulk-input',
    label: '一括入力',
    icon: ListChecks,
  },
  {
    href: '/payments',
    label: '支払い管理',
    mobileLabel: '支払い',
    icon: CreditCard,
    showInBottomNav: true,
    activeMatch: ['/payments'],
  },
];

export const BOTTOM_NAVIGATION = APP_NAVIGATION.filter((item) => item.showInBottomNav);
