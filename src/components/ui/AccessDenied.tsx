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
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="text-gray-400" size={40} />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">{title}</h1>
        <p className="text-gray-500 mb-8">{message}</p>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={18} />
          ダッシュボードに戻る
        </Link>
      </div>
    </div>
  );
}
