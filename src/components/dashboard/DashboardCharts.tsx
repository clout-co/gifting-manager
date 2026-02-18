'use client';

import type { DashboardFullStats } from '@/hooks/useQueries';
import {
  AlertCircle,
  CalendarDays,
  Package,
  Trophy,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Props = {
  stats?: DashboardFullStats | null;
};

type TooltipValue = number | string | ReadonlyArray<number | string> | undefined;

function coerceNumber(value: TooltipValue): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function truncateCode(code: string): string {
  return code.length > 10 ? `${code.slice(0, 8)}…` : code;
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 px-6">
      <div className="text-center">
        <AlertCircle size={18} className="mx-auto text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(value);

  const formatNumber = (value: number) => new Intl.NumberFormat('ja-JP').format(value);

  const formatTooltipCurrency = (value: TooltipValue) => {
    const numeric = coerceNumber(value);
    return numeric === null ? value ?? '' : formatCurrency(numeric);
  };

  const formatTooltipNumber = (value: TooltipValue) => {
    const numeric = coerceNumber(value);
    return numeric === null ? value ?? '' : formatNumber(numeric);
  };

  const tooltipStyle = {
    borderRadius: '12px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-card)',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  } as const;

  const preSaleTotal = stats.itemPostTimingStats.reduce((sum, row) => sum + row.pre_sale_posts, 0);
  const postSaleTotal = stats.itemPostTimingStats.reduce((sum, row) => sum + row.post_sale_posts, 0);
  const noPostTotal = stats.itemPostTimingStats.reduce((sum, row) => sum + row.no_post, 0);
  const topCostItem = stats.itemCostStats[0] || null;
  const latestMonthly = stats.monthlyStats[stats.monthlyStats.length - 1] || null;
  const totalScreened = stats.influencerScreening.reduce((sum, row) => sum + row.count, 0);
  const maxLikes = Math.max(...stats.influencerRanking.map((inf) => inf.total_likes), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Package className="text-muted-foreground" size={18} />
                <h3 className="font-bold text-foreground">品番ごとの費用</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">横軸: 品番 / 縦軸: 費用</p>
            </div>
            {topCostItem ? (
              <div className="rounded-xl border border-border bg-muted px-3 py-2 text-right">
                <p className="text-[11px] text-muted-foreground">最高費用品番</p>
                <p className="text-xs font-semibold text-foreground">{topCostItem.item_code}</p>
                <p className="text-sm font-bold text-foreground">{formatCurrency(topCostItem.total_cost)}</p>
              </div>
            ) : null}
          </div>
          <div className="h-80">
            {stats.itemCostStats.length === 0 ? (
              <EmptyChart message="表示できる品番データがありません" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.itemCostStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="item_code"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={74}
                    tickFormatter={(value) => truncateCode(String(value))}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(label) => `品番: ${label}`}
                    formatter={(value, name) => {
                      if (name === 'total_cost') return [formatTooltipCurrency(value), '費用'];
                      if (name === 'campaigns') return [formatTooltipNumber(value), '案件数'];
                      return [formatTooltipNumber(value), name];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="total_cost" fill="#0f172a" name="費用" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="text-muted-foreground" size={18} />
                <h3 className="font-bold text-foreground">品番別 投稿タイミング</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">販売日前 / 販売後 / 未投稿 を比較</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted px-2 py-1.5 border border-border">
                <p className="text-[10px] text-muted-foreground">販売前</p>
                <p className="text-sm font-semibold text-foreground">{formatNumber(preSaleTotal)}</p>
              </div>
              <div className="rounded-lg bg-muted px-2 py-1.5 border border-border">
                <p className="text-[10px] text-muted-foreground">販売後</p>
                <p className="text-sm font-semibold text-foreground">{formatNumber(postSaleTotal)}</p>
              </div>
              <div className="rounded-lg bg-muted px-2 py-1.5 border border-border">
                <p className="text-[10px] text-muted-foreground">未投稿</p>
                <p className="text-sm font-semibold text-foreground">{formatNumber(noPostTotal)}</p>
              </div>
            </div>
          </div>
          <div className="h-80">
            {stats.itemPostTimingStats.length === 0 ? (
              <EmptyChart message="投稿タイミングの比較データがありません" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.itemPostTimingStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="item_code"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={74}
                    tickFormatter={(value) => truncateCode(String(value))}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(label) => `品番: ${label}`}
                    formatter={(value, name) => {
                      if (name === 'pre_sale_posts') return [formatTooltipNumber(value), '販売日前投稿'];
                      if (name === 'post_sale_posts') return [formatTooltipNumber(value), '販売後投稿'];
                      if (name === 'no_post') return [formatTooltipNumber(value), '未投稿'];
                      return [formatTooltipNumber(value), name];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="pre_sale_posts" stackId="timing" fill="#1d4ed8" name="販売日前投稿" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="post_sale_posts" stackId="timing" fill="#3b82f6" name="販売後投稿" />
                  <Bar dataKey="no_post" stackId="timing" fill="#cbd5e1" name="未投稿" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="text-muted-foreground" size={18} />
                <h3 className="font-bold text-foreground">月次推移（費用・案件数）</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">販売日ベースの月次トレンド</p>
            </div>
            {latestMonthly ? (
              <div className="rounded-xl border border-border bg-muted px-3 py-2 text-right">
                <p className="text-[11px] text-muted-foreground">{latestMonthly.month}</p>
                <p className="text-xs text-foreground">案件 {formatNumber(latestMonthly.campaigns)}</p>
                <p className="text-sm font-bold text-foreground">{formatCurrency(latestMonthly.amount)}</p>
              </div>
            ) : null}
          </div>

          <div className="h-80">
            {stats.monthlyStats.length === 0 ? (
              <EmptyChart message="月次の集計データがありません" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.monthlyStats}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f172a" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#0f172a" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="colorCampaigns" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => {
                      if (name === 'amount') return [formatTooltipCurrency(value), '費用'];
                      if (name === 'campaigns') return [formatTooltipNumber(value), '案件数'];
                      return [formatTooltipNumber(value), name];
                    }}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="amount"
                    stroke="#0f172a"
                    fill="url(#colorCost)"
                    strokeWidth={2}
                    name="費用"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="campaigns"
                    stroke="#64748b"
                    fill="url(#colorCampaigns)"
                    strokeWidth={2}
                    name="案件数"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Users className="text-muted-foreground" size={18} />
                <h3 className="font-bold text-foreground">インフルエンサースクリーニング</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">平均いいねで分類（3000+ / 1000+ / 500以下）</p>
            </div>
            <div className="rounded-xl border border-border bg-muted px-3 py-2 text-right">
              <p className="text-[11px] text-muted-foreground">対象人数</p>
              <p className="text-sm font-bold text-foreground">{formatNumber(totalScreened)}名</p>
            </div>
          </div>
          <div className="h-80">
            {stats.influencerScreening.length === 0 ? (
              <EmptyChart message="スクリーニング用データがありません" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.influencerScreening}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="segment" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={58} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [formatTooltipNumber(value), '人数']}
                  />
                  <Legend />
                  <Bar dataKey="count" name="人数" radius={[6, 6, 0, 0]}>
                    {stats.influencerScreening.map((entry) => (
                      <Cell key={entry.segment} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {stats.influencerScreening.map((entry) => {
              const ratio = totalScreened > 0 ? (entry.count / totalScreened) * 100 : 0;
              return (
                <div key={entry.segment} className="rounded-lg border border-border bg-muted/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{entry.segment}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatNumber(entry.count)}名
                    <span className="ml-1 text-xs font-normal text-muted-foreground">({ratio.toFixed(1)}%)</span>
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="text-muted-foreground" size={18} />
          <h3 className="font-bold text-foreground">インフルエンサーランキング TOP10</h3>
        </div>
        {stats.influencerRanking.length === 0 ? (
          <EmptyChart message="ランキング対象データがありません" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {stats.influencerRanking.map((inf, index) => {
              const width = Math.max(6, (inf.total_likes / maxLikes) * 100);
              return (
                <div key={`${inf.display_name}-${index}`} className="rounded-xl border border-border bg-muted/70 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {index + 1}. @{inf.display_name}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        案件 {formatNumber(inf.total_campaigns)} / いいね {formatNumber(inf.total_likes)}
                      </p>
                    </div>
                    <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {inf.rank}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-border/80">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-slate-800 to-slate-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

