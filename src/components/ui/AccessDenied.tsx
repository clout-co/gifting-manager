'use client';

import { ShieldOff, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface AccessDeniedProps {
  title?: string;
  message?: string;
}

export default function AccessDenied({
  title = 'アクセス権限がありません',
  message = 'このページを閲覧する権限がありません。管理者にお問い合わせください。',
}: AccessDeniedProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="text-muted-foreground" size={40} />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-3">{title}</h1>
        <p className="text-muted-foreground mb-8">{message}</p>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={18} />
          ダッシュボードに戻る
        </Link>
      </div>
    </div>
  );
}
