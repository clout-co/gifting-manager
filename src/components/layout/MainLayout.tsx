'use client';

import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import AIChatWidget from '@/components/ui/AIChatWidget';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {/* 背景デコレーション */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200/30 dark:bg-primary-900/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-200/30 dark:bg-purple-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-pink-200/20 dark:bg-pink-900/10 rounded-full blur-3xl" />
      </div>

      <Sidebar />
      <main className="lg:ml-72 min-h-screen relative pb-20 lg:pb-0">
        <div className="p-4 lg:p-8 animate-fade-in">{children}</div>
      </main>

      {/* モバイル用ボトムナビゲーション */}
      <BottomNav />

      {/* AIチャットウィジェット */}
      <AIChatWidget />
    </div>
  );
}
