'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { translateError } from '@/lib/toast';
import LoadingSpinner, { StatCardSkeleton } from '@/components/ui/LoadingSpinner';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import { useBrand } from '@/contexts/BrandContext';
import { useDashboardFullStats, useDashboardKpis, useItemCodes } from '@/hooks/useQueries';
import {
  Users,
  Gift,
  Heart,
  MessageCircle,
  DollarSign,
  Target,
} from 'lucide-react';

const DashboardCharts = dynamic(() => import('@/components/dashboard/DashboardCharts'), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="card animate-pulse h-96" />
      <div className="card animate-pulse h-80" />
      <div className="card animate-pulse h-56" />
    </div>
  ),
});

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { currentBrand } = useBrand();
  const [selectedItem, setSelectedItem] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [detailsEnabled, setDetailsEnabled] = useState(false);

  // KPIのみ先に出す（体感速度改善）
  const {
    data: kpis,
    isLoading: kpisLoading,
    error: kpisErrorRaw,
    refetch: refetchKpis,
  } = useDashboardKpis(selectedItem, dateRange);

  const {
    data: fullStats,
    isLoading: fullLoading,
    error: fullErrorRaw,
    refetch: refetchFull,
  } = useDashboardFullStats(selectedItem, dateRange, { enabled: detailsEnabled });

  const { data: itemCodes = [] } = useItemCodes();

  const kpisError = kpisErrorRaw ? translateError(kpisErrorRaw) : null;
  const fullError = fullErrorRaw ? translateError(fullErrorRaw) : null;

  useEffect(() => {
    const t = window.setTimeout(() => setDetailsEnabled(true), 400);
    return () => window.clearTimeout(t);
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('ja-JP').format(value);
  };

  if (authLoading) {
    return <LoadingSpinner fullScreen message="認証中..." />;
  }

  if (kpisError && !kpisLoading) {
    return (
      <MainLayout>
        <ErrorDisplay
          message={kpisError}
          onRetry={() => refetchKpis()}
          showHomeLink
        />
      </MainLayout>
    );
  }

  if (kpisLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-muted rounded-xl animate-pulse" />
            <div>
              <div className="h-6 w-40 bg-muted rounded animate-pulse" />
              <div className="h-4 w-32 bg-muted rounded mt-1 animate-pulse" />
            </div>
          </div>
          <StatCardSkeleton count={5} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card animate-pulse h-96" />
            <div className="lg:col-span-2 space-y-6">
              <div className="card animate-pulse h-64" />
              <div className="grid grid-cols-2 gap-6">
                <div className="card animate-pulse h-48" />
                <div className="card animate-pulse h-48" />
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!kpis) return null;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
                <p className="text-muted-foreground mt-0.5">ギフティング活動のBI分析</p>
              </div>
            </div>
          </div>

          {/* フィルター */}
          <div className="flex flex-wrap gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="input-field text-sm min-w-[120px]"
            >
              <option value="all">全期間</option>
              <option value="7d">過去7日</option>
              <option value="30d">過去30日</option>
              <option value="90d">過去90日</option>
              <option value="1y">過去1年</option>
            </select>

            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="input-field text-sm min-w-[120px]"
            >
              <option value="all">全商品</option>
              {itemCodes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPIカード */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">総案件数</p>
                <p className="text-3xl font-bold mt-1 text-foreground">{formatNumber(kpis.totalCampaigns)}</p>
              </div>
              <div className="p-3 bg-muted rounded-xl">
                <Gift className="text-muted-foreground" size={24} />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">インフルエンサー</p>
                <p className="text-3xl font-bold mt-1 text-foreground">{formatNumber(kpis.totalInfluencers)}</p>
              </div>
              <div className="p-3 bg-muted rounded-xl">
                <Users className="text-muted-foreground" size={24} />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">総支出額</p>
                <p className="text-2xl font-bold mt-1 text-foreground">{formatCurrency(kpis.totalSpent)}</p>
              </div>
              <div className="p-3 bg-muted rounded-xl">
                <DollarSign className="text-muted-foreground" size={24} />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">総いいね</p>
                <p className="text-3xl font-bold mt-1 text-foreground">{formatNumber(kpis.totalLikes)}</p>
              </div>
              <div className="p-3 bg-muted rounded-xl">
                <Heart className="text-muted-foreground" size={24} />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">いいね単価</p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {kpis.totalLikes > 0 ? formatCurrency(kpis.totalSpent / kpis.totalLikes) : '-'}
                </p>
              </div>
              <div className="p-3 bg-muted rounded-xl">
                <Target className="text-muted-foreground" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* 詳細分析（チャート） */}
        {!detailsEnabled ? (
          <div className="card bg-muted border-border">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-foreground">詳細分析</div>
                <div className="text-sm text-muted-foreground mt-1">
                  チャートは重いので後から読み込みます（初回表示を優先）。
                </div>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setDetailsEnabled(true)}
              >
                読み込む
              </button>
            </div>
          </div>
        ) : fullError ? (
          <ErrorDisplay
            message={fullError}
            onRetry={() => refetchFull()}
            variant="card"
          />
        ) : (
          <DashboardCharts stats={fullStats || null} />
        )}
      </div>
    </MainLayout>
  );
}
