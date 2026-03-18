import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '請求先情報入力フォーム',
  description: 'インフルエンサー請求先情報入力フォーム',
  robots: { index: false, follow: false },
};

export default function FormLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {children}
    </div>
  );
}
