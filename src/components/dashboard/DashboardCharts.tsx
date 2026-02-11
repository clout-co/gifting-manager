'use client';

import type { DashboardFullStats } from '@/hooks/useQueries';
import {
  Trophy,
  Package,
  TrendingUp,
  Zap,
  Heart,
  MessageCircle,
  Target,
  Gift,
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
} from 'recharts';

type Props = {
  stats?: DashboardFullStats | null;
};

export default function DashboardCharts({ stats }: Props) {
  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="card animate-pulse h-96" />
        <div className="card animate-pulse h-80" />
        <div className="card animate-pulse h-56" />
      </div>
    );
  }

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

  type TooltipValue = number | string | ReadonlyArray<number | string> | undefined;

  const coerceNumber = (value: TooltipValue) => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const formatTooltipNumber = (value: TooltipValue) => {
    const numeric = coerceNumber(value);
    return numeric === null ? value ?? '' : formatNumber(numeric);
  };

  const formatTooltipCurrency = (value: TooltipValue) => {
    const numeric = coerceNumber(value);
    return numeric === null ? value ?? '' : formatCurrency(numeric);
  };

  return (
    <>
      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* インフルエンサーランキング */}
        <div className="card lg:col-span-1">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="text-muted-foreground" size={20} />
            <h3 className="font-bold text-foreground">成績ランキング TOP10</h3>
          </div>
          <div className="space-y-2">
            {stats.influencerRanking.map((inf, index) => (
              <div
                key={inf.display_name}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted transition-colors"
              >
                <div className="flex-shrink-0 w-6 text-center">
                  <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">@{inf.display_name}</p>
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {inf.rank}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {inf.total_campaigns}件 | スコア: {inf.score}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-foreground">
                    <Heart size={14} />
                    <span className="font-bold">{formatNumber(inf.total_likes)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
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
              <Package className="text-muted-foreground" size={20} />
              <h3 className="font-bold text-foreground">商品別パフォーマンス</h3>
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
                    formatter={(value, name) => {
                      if (name === 'likes') return [formatTooltipNumber(value), 'いいね'];
                      if (name === 'comments') return [formatTooltipNumber(value), 'コメント'];
                      return [formatTooltipNumber(value), name];
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
              <h3 className="font-bold text-foreground mb-4">ステータス別割合</h3>
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
                    <span className="text-xs text-muted-foreground">
                      {item.name}: {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-bold text-foreground mb-4">ブランド別支出</h3>
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
                      formatter={(value) => formatTooltipCurrency(value)}
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
          <TrendingUp className="text-muted-foreground" size={20} />
          <h3 className="font-bold text-foreground">月別トレンド</h3>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.monthlyStats}>
              <defs>
                <linearGradient id="colorCampaigns" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#374151" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#374151" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
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
                formatter={(value, name) => {
                  if (name === '支出額') return formatTooltipCurrency(value);
                  return formatTooltipNumber(value);
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
          <Zap className="text-muted-foreground" size={20} />
          <h3 className="font-bold text-foreground">コスト効率分析</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-muted rounded-xl border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="text-muted-foreground" size={18} />
              <span className="text-sm text-muted-foreground">いいね単価</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats.totalLikes > 0 ? formatCurrency(stats.totalSpent / stats.totalLikes) : '-'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">1いいねあたり</p>
          </div>

          <div className="p-5 bg-muted rounded-xl border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="text-muted-foreground" size={18} />
              <span className="text-sm text-muted-foreground">コメント単価</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats.totalComments > 0 ? formatCurrency(stats.totalSpent / stats.totalComments) : '-'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">1コメントあたり</p>
          </div>

          <div className="p-5 bg-muted rounded-xl border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="text-muted-foreground" size={18} />
              <span className="text-sm text-muted-foreground">案件単価</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats.totalCampaigns > 0 ? formatCurrency(stats.totalSpent / stats.totalCampaigns) : '-'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">1案件あたり</p>
          </div>

          <div className="p-5 bg-muted rounded-xl border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Star className="text-muted-foreground" size={18} />
              <span className="text-sm text-muted-foreground">エンゲージメント率</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats.totalLikes > 0
                ? ((stats.totalComments / stats.totalLikes) * 100).toFixed(1) + '%'
                : '-'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">コメント/いいね</p>
          </div>
        </div>
      </div>

      <div className="card bg-muted border-border">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <Target className="text-muted-foreground" size={18} />
          </div>
          <div>
            <div className="font-medium text-foreground">初回ロード高速化</div>
            <div className="text-sm text-muted-foreground mt-1">
              KPIを先に表示し、重いチャートは後から読み込みます（体感速度優先）。
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
