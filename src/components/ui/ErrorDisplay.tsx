'use client';

import { AlertCircle, RefreshCw, Home, XCircle } from 'lucide-react';
import Link from 'next/link';

interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  showHomeLink?: boolean;
  variant?: 'inline' | 'card' | 'fullPage';
}

export default function ErrorDisplay({
  title = 'エラーが発生しました',
  message,
  onRetry,
  showHomeLink = false,
  variant = 'card',
}: ErrorDisplayProps) {
  // インライン表示（フォーム内などの小さなエラー）
  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">
        <XCircle size={16} className="flex-shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  // カード表示（セクション内のエラー）
  if (variant === 'card') {
    return (
      <div className="card border-red-200 bg-red-50/50">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 rounded-xl">
            <AlertCircle className="text-red-600" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-red-900">{title}</h3>
            <p className="text-red-700 mt-1 text-sm">{message}</p>
            {(onRetry || showHomeLink) && (
              <div className="flex gap-2 mt-4">
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    <RefreshCw size={16} />
                    再試行
                  </button>
                )}
                {showHomeLink && (
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    <Home size={16} />
                    ダッシュボードへ
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // フルページ表示（致命的なエラー）
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
          <AlertCircle className="text-red-600" size={40} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className="btn-primary flex items-center gap-2"
            >
              <RefreshCw size={18} />
              再試行
            </button>
          )}
          {showHomeLink && (
            <Link href="/dashboard" className="btn-secondary flex items-center gap-2">
              <Home size={18} />
              ダッシュボードへ
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// 空の状態を表示するコンポーネント
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon && (
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-gray-500 text-sm mb-4">{description}</p>
      )}
      {action && (
        <button onClick={action.onClick} className="btn-primary">
          {action.label}
        </button>
      )}
    </div>
  );
}
