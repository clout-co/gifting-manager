'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  BarChart3,
  Gift,
  Upload,
} from 'lucide-react';

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  activeMatch?: string[];
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    icon: <Home size={20} />,
    label: 'ホーム',
  },
  {
    href: '/campaigns',
    icon: <Gift size={20} />,
    label: '案件',
  },
  {
    href: '/influencers',
    icon: <Users size={20} />,
    label: 'インフルエンサー',
    activeMatch: ['/influencers'],
  },
  {
    href: '/analytics',
    icon: <BarChart3 size={20} />,
    label: '分析',
  },
  {
    href: '/import',
    icon: <Upload size={20} />,
    label: 'インポート',
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    if (item.activeMatch) {
      return item.activeMatch.some(match => pathname.startsWith(match));
    }
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-40 lg:hidden safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors ${
                active ? 'bg-primary-100 dark:bg-primary-900/30' : ''
              }`}>
                {item.icon}
              </div>
              <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
