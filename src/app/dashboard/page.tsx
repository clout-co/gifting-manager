'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast, translateError } from '@/lib/toast';
import LoadingSpinner, { StatCardSkeleton } from '@/components/ui/LoadingSpinner';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import { useBrand } from '@/contexts/BrandContext';
import { useDashboardFullStats } from '@/hooks/useQueries';
import {
  Users,
  Gift,
  Heart,
  MessageCircle,
  Loader2,
  DollarSign,
  Trophy,
  TrendingUp,
  TrendingDown,
  Award,
  Package,
  Sparkles,
  Target,
  Zap,
  Crown,
  Medal,
  Star,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
  RadialBarChart,
  RadialBar,
} from 'recharts';

interface Stats {
  totalCampaigns: number;
  totalInfluencers: number;
  totalSpent: number;
  totalLikes: number;
  totalComments: number;
  statusBreakdown: { name: string; value: number; color: string }[];
  brandStats: { brand: string; count: number; amount: number; likes: number }[];
  monthlyStats: { month: string; campaigns: number; amount: number; likes: number }[];
  influencerRanking: {
    display_name: string;
    total_likes: number;
    total_comments: number;
    total_campaigns: number;
    total_amount: number;
    cost_per_like: number;
    score: number;
    rank: string;
  }[];
  itemStats: {
    item_code: string;
    count: number;
    likes: number;
    comments: number;
    amount: number;
  }[];
}

const COLORS = ['#374151', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6'];

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { currentBrand } = useBrand();
  const [selectedItem, setSelectedItem] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [items, setItems] = useState<string[]>([]);

  // React Query for dashboard stats
  const { data: stats, isLoading: loading, error: queryError, refetch } = useDashboardFullStats(selectedItem, dateRange);
  const error = queryError ? translateError(queryError) : null;

  // Fetch item codes for filter dropdown
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('item_code')
          .eq('brand', currentBrand);
        if (error) throw error;
        if (data) {
          setItems(Array.from(new Set(data.map(c => c.item_code).filter(Boolean))) as string[]);
        }
      } catch (err) {
        console.error('Failed to fetch filters:', err);
      }
    };
    fetchFilters();
  }, [currentBrand]);

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

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="text-yellow-500" size={20} />;
      case 1:
        return <Medal className="text-gray-400" size={20} />;
      case 2:
        return <Medal className="text-orange-400" size={20} />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-400">{index + 1}</span>;
    }
  };

  if (authLoading) {
    return <LoadingSpinner fullScreen message="認証中..." />;
  }

  if (error && !loading) {
    return (
      <MainLayout>
        <ErrorDisplay
          message={error}
          onRetry={() => refetch()}
          showHomeLink
        />
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse" />
            <div>
              <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gray-100 rounded mt-1 animate-pulse" />
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

  if (!stats) return null;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
                <p className="text-gray-500 mt-0.5">ギフティング活動のBI分析</p>
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
              {items.map((item) => (
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
                <p className="text-sm text-gray-500">総案件数</p>
                <p className="text-3xl font-bold mt-1 text-gray-900">{formatNumber(stats.totalCampaigns)}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-xl">
                <Gift className="text-gray-500" size={24} />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">インフルエンサー</p>
                <p className="text-3xl font-bold mt-1 text-gray-900">{formatNumber(stats.totalInfluencers)}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-xl">
                <Users className="text-gray-500" size={24} />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">総支出額</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">{formatCurrency(stats.totalSpent)}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-xl">
                <DollarSign className="text-gray-500" size={24} />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">総いいね</p>
                <p className="text-3xl font-bold mt-1 text-gray-900">{formatNumber(stats.totalLikes)}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-xl">
                <Heart className="text-gray-500" size={24} />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">いいね単価</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">
                  {stats.totalLikes > 0 ? formatCurrency(stats.totalSpent / stats.totalLikes) : '-'}
                </p>
              </div>
              <div className="p-3 bg-gray-100 rounded-xl">
                <Target className="text-gray-500" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* インフルエンサーランキング */}
          <div className="card lg:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <Trophy className="text-gray-500" size={20} />
              <h3 className="font-bold text-gray-900">成績ランキング TOP10</h3>
            </div>
            <div className="space-y-2">
              {stats.influencerRanking.map((inf, index) => (
                <div
                  key={inf.display_name}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-shrink-0 w-6 text-center">
                    <span className="text-sm font-bold text-gray-500">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">@{inf.display_name}</p>
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{inf.rank}</span>
                    </div>
                    <p className="text-xs text-gray-500">{inf.total_campaigns}件 | スコア: {inf.score}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-gray-700">
                      <Heart size={14} />
                      <span className="font-bold">{formatNumber(inf.total_likes)}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {inf.cost_per_like > 0 ? `¥${Math.round(inf.cost_per_like)}/like` : '-'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 商品別パフォーマンス & ステータス */}
          <div className="lg:col-span-2 space-y-6">
            {/* 商品別パフォーマンス */}
            <div className="card">
              <div className="flex items-center gap-2 mb-6">
                <Package className="text-gray-500" size={20} />
                <h3 className="font-bold text-gray-900">商品別パフォーマンス</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.itemStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="item_code" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'likes') return [formatNumber(value), 'いいね'];
                        if (name === 'comments') return [formatNumber(value), 'コメント'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="likes" fill="#374151" name="いいね" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="comments" fill="#9ca3af" name="コメント" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ステータス別 & ブランド別 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-bold text-gray-900 mb-4">ステータス別割合</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.statusBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.statusBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {stats.statusBreakdown.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-600">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="font-bold text-gray-900 mb-4">ブランド別支出</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.brandStats.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="brand" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="amount" fill="#374151" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 月別トレンド */}
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-gray-500" size={20} />
            <h3 className="font-bold text-gray-900">月別トレンド</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.monthlyStats}>
                <defs>
                  <linearGradient id="colorCampaigns" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#374151" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#374151" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#9ca3af" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === '支出額') return formatCurrency(value);
                    return formatNumber(value);
                  }}
                />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="campaigns"
                  stroke="#374151"
                  strokeWidth={2}
                  fill="url(#colorCampaigns)"
                  name="案件数"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="likes"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  fill="url(#colorLikes)"
                  name="いいね"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* コスト効率分析 */}
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="text-gray-500" size={20} />
            <h3 className="font-bold text-gray-900">コスト効率分析</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="text-gray-400" size={18} />
                <span className="text-sm text-gray-500">いいね単価</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalLikes > 0 ? formatCurrency(stats.totalSpent / stats.totalLikes) : '-'}
              </p>
              <p className="text-xs text-gray-400 mt-1">1いいねあたり</p>
            </div>

            <div className="p-5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="text-gray-400" size={18} />
                <span className="text-sm text-gray-500">コメント単価</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalComments > 0 ? formatCurrency(stats.totalSpent / stats.totalComments) : '-'}
              </p>
              <p className="text-xs text-gray-400 mt-1">1コメントあたり</p>
            </div>

            <div className="p-5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="text-gray-400" size={18} />
                <span className="text-sm text-gray-500">案件単価</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalCampaigns > 0 ? formatCurrency(stats.totalSpent / stats.totalCampaigns) : '-'}
              </p>
              <p className="text-xs text-gray-400 mt-1">1案件あたり</p>
            </div>

            <div className="p-5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Star className="text-gray-400" size={18} />
                <span className="text-sm text-gray-500">エンゲージメント率</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalLikes > 0
                  ? ((stats.totalComments / stats.totalLikes) * 100).toFixed(1) + '%'
                  : '-'}
              </p>
              <p className="text-xs text-gray-400 mt-1">コメント/いいね</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
