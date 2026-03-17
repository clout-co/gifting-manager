'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { BOTTOM_NAVIGATION } from './navigation';

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string, activeMatch?: string[]) => {
    if (activeMatch) {
      return activeMatch.some((match) => pathname.startsWith(match));
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-40 lg:hidden safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {BOTTOM_NAVIGATION.map((item) => {
          const active = isActive(item.href, item.activeMatch);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <div className={cn(
                'p-1.5 rounded-lg transition-colors',
                active && 'bg-primary/10'
              )}>
                <Icon size={20} />
              </div>
              <span className="text-[10px] mt-0.5 font-medium">{item.mobileLabel || item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
