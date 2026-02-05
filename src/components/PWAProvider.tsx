'use client';

import { useEffect, useState } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Service Worker の登録
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {
          // Service Worker registration failed
        });
    }

    // iOS 判定
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // スタンドアロンモード判定（iOS Safari用のstandaloneプロパティ）
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
      nav.standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(isInStandaloneMode);

    // インストールプロンプトのイベントをキャプチャ
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // 一度閉じてから1日経過していない場合は表示しない
      const lastDismissed = localStorage.getItem('pwa-banner-dismissed');
      if (lastDismissed) {
        const dismissedDate = new Date(lastDismissed);
        const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 1) return;
      }

      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    // PWA installed or dismissed

    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa-banner-dismissed', new Date().toISOString());
  };

  // iOS用のインストール案内を表示
  const showIOSBanner = isIOS && !isStandalone && !localStorage.getItem('pwa-ios-dismissed');

  return (
    <>
      {children}

      {/* PWAインストールバナー（Android/デスクトップ） */}
      {showInstallBanner && !isStandalone && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-primary-600 to-purple-600 text-white p-4 rounded-2xl shadow-2xl z-50 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Download size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold">アプリをインストール</h3>
              <p className="text-sm opacity-90 mt-1">
                ホーム画面に追加して、より快適にご利用いただけます
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  className="px-4 py-2 bg-white text-primary-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  インストール
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
                >
                  後で
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* iOS用のインストール案内 */}
      {showIOSBanner && (
        <div className="fixed bottom-4 left-4 right-4 bg-white border border-gray-200 p-4 rounded-2xl shadow-2xl z-50 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-100 rounded-xl">
              <Smartphone className="text-primary-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">アプリとして使う</h3>
              <p className="text-sm text-gray-600 mt-1">
                Safari で「共有」→「ホーム画面に追加」をタップ
              </p>
            </div>
            <button
              onClick={() => {
                localStorage.setItem('pwa-ios-dismissed', 'true');
                setIsIOS(false);
              }}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
