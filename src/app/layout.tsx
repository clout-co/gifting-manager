import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.css';
import { ToastProvider } from '@/lib/toast';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import { ThemeProvider } from '@/components/ThemeProvider';
// PWAProvider removed — install banner is no longer needed
import { BrandProvider } from '@/contexts/BrandContext';
import ForceRelogin from '@/components/ForceRelogin';
import QueryProvider from '@/providers/QueryProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import RealtimeSync from '@/components/RealtimeSync';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Gifting Manager - インフルエンサーギフティング管理',
  description: 'アパレルブランドのインフルエンサーギフティング管理システム',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Gifting Manager',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#8b5cf6',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const theme = cookieStore.get('clout_theme')?.value;
  const htmlClassName = theme === 'dark' ? 'dark' : undefined;

  return (
    <html lang="ja" suppressHydrationWarning className={htmlClassName}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <QueryProvider>
            <ThemeProvider>
              <BrandProvider>
                <RealtimeSync />
                <ToastProvider>
                  <ConfirmProvider>
                    <ForceRelogin>
                      {children}
                    </ForceRelogin>
                  </ConfirmProvider>
                </ToastProvider>
              </BrandProvider>
            </ThemeProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
