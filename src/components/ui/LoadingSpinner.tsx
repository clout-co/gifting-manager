'use client';

import { Loader2, Sparkles } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullScreen?: boolean;
  withSparkle?: boolean;
}

export default function LoadingSpinner({
  size = 'md',
  message,
  fullScreen = false,
  withSparkle = false,
}: LoadingSpinnerProps) {
  const sizeMap = {
    sm: 20,
    md: 40,
    lg: 64,
  };

  const iconSize = sizeMap[size];

  const content = (
    <div className="text-center">
      <div className="relative inline-block">
        <Loader2
          className="animate-spin text-primary-500"
          size={iconSize}
        />
        {withSparkle && (
          <Sparkles
            className="absolute -top-1 -right-1 text-yellow-400 animate-pulse"
            size={iconSize * 0.4}
          />
        )}
      </div>
      {message && (
        <p className="mt-3 text-gray-500 text-sm">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {content}
    </div>
  );
}

// テーブル用のスケルトンローダー
export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden">
      <div className="animate-pulse">
        {/* ヘッダー */}
        <div className="flex gap-4 p-4 bg-gray-50 border-b">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="flex-1 h-4 bg-gray-200 rounded" />
          ))}
        </div>
        {/* 行 */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 p-4 border-b border-gray-100">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="flex-1 h-4 bg-gray-100 rounded"
                style={{
                  width: `${60 + Math.random() * 40}%`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// カード用のスケルトンローダー
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gray-200 rounded-xl" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-2 bg-gray-100 rounded" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-16 bg-gray-50 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 統計カード用のスケルトンローダー
export function StatCardSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-6 bg-gray-100 rounded w-3/4" />
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
