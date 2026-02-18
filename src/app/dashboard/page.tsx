'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { translateError } from '@/lib/toast';
import LoadingSpinner, { StatCardSkeleton } from '@/components/ui/LoadingSpinner';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import { useBrand } from '@/contexts/BrandContext';
import { useDashboardFullStats, useDashboardKpis, useItemCodes } from '@/hooks/useQueries';
import {
  Boxes,
  CalendarRange,
  DollarSign,
  Gift,
  Heart,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
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

type KpiCard = {
  key: string;
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  accentClass: string;
  iconBg: string;
};

const DATE_RANGE_LABEL: Record<string, string> = {
  all: '全期間',
  '7d': '過去7日',
  '30d': '過去30日',
  '90d': '過去90日',
  '1y': '過去1年',
};

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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(value);

  const formatNumber = (value: number) => new Intl.NumberFormat('ja-JP').format(value);

  const kpiCards: KpiCard[] = useMemo(() => {
    if (!kpis) return [];

    return [
      {
        key: 'campaigns',
        label: '総案件数',
        value: formatNumber(kpis.totalCampaigns),
        note: `合意 ${formatNumber(kpis.agreedCount)} / 保留 ${formatNumber(kpis.pendingCount)}`,
        icon: Gift,
        accentClass: 'from-slate-900 to-slate-700',
        iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
      },
      {
        key: 'influencers',
        label: 'インフルエンサー',
        value: formatNumber(kpis.totalInfluencers),
        note: 'ユニーク人数',
        icon: Users,
        accentClass: 'from-blue-600 to-sky-500',
        iconBg: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      },
      {
        key: 'spent',
        label: '総支出額',
        value: formatCurrency(kpis.totalSpent),
        note: '案件費+原価+送料',
        icon: DollarSign,
        accentClass: 'from-emerald-600 to-emerald-500',
        iconBg: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
      },
      {
        key: 'likes',
        label: '総いいね',
        value: formatNumber(kpis.totalLikes),
        note: `コメント ${formatNumber(kpis.totalComments)}`,
        icon: Heart,
        accentClass: 'from-rose-600 to-pink-500',
        iconBg: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
      },
      {
        key: 'cpl',
        label: 'いいね単価',
        value: kpis.totalLikes > 0 ? formatCurrency(kpis.totalSpent / kpis.totalLikes) : '-',
        note: '1いいねの平均費用',
        icon: Target,
        accentClass: 'from-violet-600 to-indigo-500',
        iconBg: 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
      },
    ];
  }, [kpis]);

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
        <div className="space-y-4">
          <div className="h-14 rounded-2xl border border-border bg-muted animate-pulse" />
          <StatCardSkeleton count={5} />
          <div className="card animate-pulse h-96" />
        </div>
      </MainLayout>
    );
  }

  if (!kpis) return null;

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Compact header with integrated filters */}
        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/5 dark:bg-foreground/10">
              <TrendingUp size={18} className="text-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">ダッシュボード</h1>
              <p className="text-xs text-muted-foreground">ギフティング案件の分析</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <CalendarRange size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="input-field h-9 py-0 pl-8 pr-3 text-xs min-w-[120px] rounded-lg"
              >
                <option value="all">全期間</option>
                <option value="7d">過去7日</option>
                <option value="30d">過去30日</option>
                <option value="90d">過去90日</option>
                <option value="1y">過去1年</option>
              </select>
            </div>

            <div className="relative">
              <Boxes size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                className="input-field h-9 py-0 pl-8 pr-3 text-xs min-w-[120px] rounded-lg"
              >
                <option value="all">全商品</option>
                {itemCodes.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* KPI Cards — compact & dense */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.key} className="relative overflow-hidden rounded-2xl border border-border bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md">
                <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${card.accentClass}`} />
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground leading-none">{card.label}</p>
                    <p className="mt-1 truncate text-xl font-bold text-foreground leading-none">{card.value}</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{card.note}</p>
              </article>
            );
          })}
        </section>

        {/* Charts */}
        {!detailsEnabled ? (
          <div className="card border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">詳細分析の準備中</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  初回描画を優先し、重いチャートは遅延ロードしています。
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setDetailsEnabled(true)}
              >
                今すぐ表示
              </button>
            </div>
          </div>
        ) : fullLoading && !fullStats ? (
          <div className="space-y-6">
            <div className="card animate-pulse h-80" />
            <div className="card animate-pulse h-80" />
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
