// NOTE:
// - SSO運用ではHTMLページをキャッシュすると認証状態/リダイレクトが壊れる。
// - 特に `/auth` がキャッシュされると、旧ログイン画面が残骸として出続ける。
// -> 静的アセットのみキャッシュし、ページ（document）はキャッシュしない。
const CACHE_NAME = 'gifting-manager-v2-20260206';
const urlsToCache = [
  '/manifest.json',
];

// Service Worker インストール
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Cache failed:', error);
      })
  );
  self.skipWaiting();
});

// Service Worker アクティベート
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ネットワークリクエストの処理
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API リクエストはキャッシュしない
  if (event.request.url.includes('/api/') ||
      event.request.url.includes('supabase.co') ||
      event.request.method !== 'GET') {
    return;
  }

  // 認証系ページは絶対にキャッシュしない
  if (url.pathname === '/auth' || url.pathname.startsWith('/auth/')) {
    return;
  }

  // HTML（ページ遷移）はキャッシュしない（SSOのリダイレクト/権限が壊れるため）
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    return;
  }

  // 静的アセットのみキャッシュ対象にする
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    /\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff2?)$/i.test(url.pathname);

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュがあればそれを返す
        if (response) {
          // バックグラウンドで更新
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          }).catch(() => {});
          return response;
        }

        // キャッシュがなければネットワークから取得
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        });
      })
  );
});

// プッシュ通知
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : '新しい通知があります',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      { action: 'explore', title: '確認する' },
      { action: 'close', title: '閉じる' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Gifting Manager', options)
  );
});

// 通知クリック
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});
