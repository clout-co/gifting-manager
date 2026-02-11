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
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    // Service Worker の登録
    const isE2E = process.env.NEXT_PUBLIC_E2E === 'true';
    if (!isE2E && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          const notifyUpdate = () => {
            // First install (no controller) should not prompt a reload.
            if (!navigator.serviceWorker.controller) return;
            setShowUpdateBanner(true);
          };

          // If there's already a waiting worker (rare with skipWaiting, but handle anyway)
          if (registration.waiting) {
            notifyUpdate();
          }

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                notifyUpdate();
              }
            });
          });
        })
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

      {/* SW更新バナー（更新が入ったのに画面が古いまま、を防ぐ） */}
      {showUpdateBanner && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-[420px] bg-primary text-white p-4 rounded-2xl shadow-2xl z-50 border border-white/10 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Download size={22} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold">新しいバージョンがあります</h3>
              <p className="text-sm text-muted-foreground mt-1">
                画面を再読み込みして最新状態に更新してください
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    if (reloading) return;
                    setReloading(true);
                    // With skipWaiting+clients.claim, a reload is enough to ensure the new assets are used.
                    window.location.reload();
                  }}
                  className="px-4 py-2 bg-white text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={reloading}
                >
                  {reloading ? '再読み込み中...' : '再読み込み'}
                </button>
                <button
                  onClick={() => setShowUpdateBanner(false)}
                  className="px-4 py-2 bg-white/10 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors"
                >
                  後で
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowUpdateBanner(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="更新バナーを閉じる"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* PWAインストールバナー（Android/デスクトップ） */}
      {showInstallBanner && !isStandalone && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-primary text-white p-4 rounded-2xl shadow-2xl z-50 border border-white/10 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Download size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold">アプリをインストール</h3>
              <p className="text-sm text-muted-foreground mt-1">
                ホーム画面に追加して、より快適にご利用いただけます
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  className="px-4 py-2 bg-white text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                >
                  インストール
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 bg-white/10 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors"
                >
                  後で
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* iOS用のインストール案内 */}
      {showIOSBanner && (
        <div className="fixed bottom-4 left-4 right-4 bg-white border border-border p-4 rounded-2xl shadow-2xl z-50 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-100 rounded-xl">
              <Smartphone className="text-primary-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground">アプリとして使う</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Safari で「共有」→「ホーム画面に追加」をタップ
              </p>
            </div>
            <button
              onClick={() => {
                localStorage.setItem('pwa-ios-dismissed', 'true');
                setIsIOS(false);
              }}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <X size={18} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
