'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast, translateError } from '@/lib/toast';
import LoadingSpinner, { StatCardSkeleton } from '@/components/ui/LoadingSpinner';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
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
    insta_name: string;
    total_likes: number;
    total_comments: number;
    total_campaigns: number;
    total_amount: number;
    cost_per_like: number;
  }[];
  itemStats: {
    item_code: string;
    count: number;
    likes: number;
    comments: number;
    amount: number;
  }[];
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [brands, setBrands] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const { data, error } = await supabase.from('campaigns').select('brand, item_code');
        if (error) throw error;
        if (data) {
          setBrands(Array.from(new Set(data.map(c => c.brand).filter(Boolean))) as string[]);
          setItems(Array.from(new Set(data.map(c => c.item_code).filter(Boolean))) as string[]);
        }
      } catch (err) {
        console.error('Failed to fetch filters:', err);
      }
    };
    fetchFilters();
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {

    let query = supabase
      .from('campaigns')
      .select('*, influencer:influencers(*)');

    if (selectedBrand !== 'all') {
      query = query.eq('brand', selectedBrand);
    }
    if (selectedItem !== 'all') {
      query = query.eq('item_code', selectedItem);
    }
    if (dateRange !== 'all') {
      const now = new Date();
      let startDate: Date;
      switch (dateRange) {
        case '7d':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case '30d':
          startDate = new Date(now.setDate(now.getDate() - 30));
          break;
        case '90d':
          startDate = new Date(now.setDate(now.getDate() - 90));
          break;
        case '1y':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(0);
      }
      query = query.gte('created_at', startDate.toISOString());
    }

    const campaignsRes = await query;
    const influencersRes = await supabase.from('influencers').select('*');

    if (campaignsRes.error) throw campaignsRes.error;
    if (influencersRes.error) throw influencersRes.error;

    const campaigns = campaignsRes.data;
    const influencers = influencersRes.data;

    if (campaigns) {
      const statusCount = { pending: 0, agree: 0, disagree: 0, cancelled: 0 };
      campaigns.forEach((c) => {
        if (c.status in statusCount) {
          statusCount[c.status as keyof typeof statusCount]++;
        }
      });

      const brandMap = new Map<string, { count: number; amount: number; likes: number }>();
      campaigns.forEach((c) => {
        const brand = c.brand || '未設定';
        const existing = brandMap.get(brand) || { count: 0, amount: 0, likes: 0 };
        brandMap.set(brand, {
          count: existing.count + 1,
          amount: existing.amount + (c.agreed_amount || 0),
          likes: existing.likes + (c.likes || 0),
        });
      });

      const monthMap = new Map<string, { campaigns: number; amount: number; likes: number }>();
      campaigns.forEach((c) => {
        const date = c.post_date || c.created_at;
        if (date) {
          const month = date.substring(0, 7);
          const existing = monthMap.get(month) || { campaigns: 0, amount: 0, likes: 0 };
          monthMap.set(month, {
            campaigns: existing.campaigns + 1,
            amount: existing.amount + (c.agreed_amount || 0),
            likes: existing.likes + (c.likes || 0),
          });
        }
      });

      const influencerMap = new Map<string, {
        insta_name: string;
        total_likes: number;
        total_comments: number;
        total_campaigns: number;
        total_amount: number;
      }>();
      campaigns.forEach((c) => {
        if (c.influencer) {
          const key = c.influencer.id;
          const existing = influencerMap.get(key) || {
            insta_name: c.influencer.insta_name,
            total_likes: 0,
            total_comments: 0,
            total_campaigns: 0,
            total_amount: 0,
          };
          influencerMap.set(key, {
            insta_name: c.influencer.insta_name,
            total_likes: existing.total_likes + (c.likes || 0),
            total_comments: existing.total_comments + (c.comments || 0),
            total_campaigns: existing.total_campaigns + 1,
            total_amount: existing.total_amount + (c.agreed_amount || 0),
          });
        }
      });

      const itemMap = new Map<string, { count: number; likes: number; comments: number; amount: number }>();
      campaigns.forEach((c) => {
        if (c.item_code) {
          const existing = itemMap.get(c.item_code) || { count: 0, likes: 0, comments: 0, amount: 0 };
          itemMap.set(c.item_code, {
            count: existing.count + 1,
            likes: existing.likes + (c.likes || 0),
            comments: existing.comments + (c.comments || 0),
            amount: existing.amount + (c.agreed_amount || 0),
          });
        }
      });

      setStats({
        totalCampaigns: campaigns.length,
        totalInfluencers: new Set(campaigns.map(c => c.influencer_id)).size,
        totalSpent: campaigns.reduce((sum, c) => sum + (c.agreed_amount || 0), 0),
        totalLikes: campaigns.reduce((sum, c) => sum + (c.likes || 0), 0),
        totalComments: campaigns.reduce((sum, c) => sum + (c.comments || 0), 0),
        statusBreakdown: [
          { name: '合意', value: statusCount.agree, color: '#10b981' },
          { name: '保留', value: statusCount.pending, color: '#f59e0b' },
          { name: '不合意', value: statusCount.disagree, color: '#ef4444' },
          { name: 'キャンセル', value: statusCount.cancelled, color: '#6b7280' },
        ].filter((s) => s.value > 0),
        brandStats: Array.from(brandMap.entries())
          .map(([brand, data]) => ({ brand, ...data }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10),
        monthlyStats: Array.from(monthMap.entries())
          .map(([month, data]) => ({ month, ...data }))
          .sort((a, b) => a.month.localeCompare(b.month))
          .slice(-12),
        influencerRanking: Array.from(influencerMap.values())
          .map((inf) => ({
            ...inf,
            cost_per_like: inf.total_likes > 0 ? inf.total_amount / inf.total_likes : 0,
          }))
          .sort((a, b) => b.total_likes - a.total_likes)
          .slice(0, 10),
        itemStats: Array.from(itemMap.entries())
          .map(([item_code, data]) => ({ item_code, ...data }))
          .sort((a, b) => b.likes - a.likes)
          .slice(0, 10),
      });
    }
    } catch (err) {
      const errorMessage = translateError(err);
      setError(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedBrand, selectedItem, dateRange, showToast]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user, fetchStats]);

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
          onRetry={fetchStats}
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
              <div className="p-3 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl shadow-lg shadow-primary-500/30">
                <Sparkles className="text-white" size={24} />
              </div>
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
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="input-field text-sm min-w-[120px]"
            >
              <option value="all">全ブランド</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
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
          <div className="stat-card group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">総案件数</p>
                <p className="text-3xl font-bold mt-1 gradient-text">{formatNumber(stats.totalCampaigns)}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-primary-100 to-primary-50 rounded-xl group-hover:scale-110 transition-transform">
                <Gift className="text-primary-600" size={28} />
              </div>
            </div>
          </div>

          <div className="stat-card group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">インフルエンサー</p>
                <p className="text-3xl font-bold mt-1">{formatNumber(stats.totalInfluencers)}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl group-hover:scale-110 transition-transform">
                <Users className="text-purple-600" size={28} />
              </div>
            </div>
          </div>

          <div className="stat-card group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">総支出額</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalSpent)}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-green-100 to-green-50 rounded-xl group-hover:scale-110 transition-transform">
                <DollarSign className="text-green-600" size={28} />
              </div>
            </div>
          </div>

          <div className="stat-card group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">総いいね</p>
                <p className="text-3xl font-bold mt-1 text-pink-600">{formatNumber(stats.totalLikes)}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-pink-100 to-pink-50 rounded-xl group-hover:scale-110 transition-transform">
                <Heart className="text-pink-600" size={28} />
              </div>
            </div>
          </div>

          <div className="stat-card group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">いいね単価</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">
                  {stats.totalLikes > 0 ? formatCurrency(stats.totalSpent / stats.totalLikes) : '-'}
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl group-hover:scale-110 transition-transform">
                <Target className="text-blue-600" size={28} />
              </div>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* インフルエンサーランキング */}
          <div className="card lg:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-gradient-to-br from-yellow-100 to-amber-100 rounded-lg">
                <Trophy className="text-yellow-600" size={20} />
              </div>
              <h3 className="font-bold text-gray-900">成績ランキング TOP10</h3>
            </div>
            <div className="space-y-3">
              {stats.influencerRanking.map((inf, index) => (
                <div
                  key={inf.insta_name}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                    index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200/50 shadow-sm' :
                    index === 1 ? 'bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200/50' :
                    index === 2 ? 'bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/50' :
                    'bg-gray-50/50 hover:bg-gray-100/50'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {getRankIcon(index)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">@{inf.insta_name}</p>
                    <p className="text-xs text-gray-500">{inf.total_campaigns}件</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-pink-500">
                      <Heart size={14} fill="currentColor" />
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
                <div className="p-2 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg">
                  <Package className="text-purple-600" size={20} />
                </div>
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
                    <Bar dataKey="likes" fill="#ec4899" name="いいね" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="comments" fill="#8b5cf6" name="コメント" radius={[0, 4, 4, 0]} />
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
                      <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
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
            <div className="p-2 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-lg">
              <TrendingUp className="text-blue-600" size={20} />
            </div>
            <h3 className="font-bold text-gray-900">月別トレンド</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.monthlyStats}>
                <defs>
                  <linearGradient id="colorCampaigns" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
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
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorCampaigns)"
                  name="案件数"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="likes"
                  stroke="#ec4899"
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
            <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg">
              <Zap className="text-green-600" size={20} />
            </div>
            <h3 className="font-bold text-gray-900">コスト効率分析</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-6 bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl border border-pink-100/50">
              <div className="flex items-center gap-3 mb-2">
                <Heart className="text-pink-500" size={20} />
                <span className="text-sm text-gray-500">いいね単価</span>
              </div>
              <p className="text-3xl font-bold text-pink-600">
                {stats.totalLikes > 0 ? formatCurrency(stats.totalSpent / stats.totalLikes) : '-'}
              </p>
              <p className="text-xs text-gray-400 mt-1">1いいねあたり</p>
            </div>

            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/50">
              <div className="flex items-center gap-3 mb-2">
                <MessageCircle className="text-blue-500" size={20} />
                <span className="text-sm text-gray-500">コメント単価</span>
              </div>
              <p className="text-3xl font-bold text-blue-600">
                {stats.totalComments > 0 ? formatCurrency(stats.totalSpent / stats.totalComments) : '-'}
              </p>
              <p className="text-xs text-gray-400 mt-1">1コメントあたり</p>
            </div>

            <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100/50">
              <div className="flex items-center gap-3 mb-2">
                <Gift className="text-green-500" size={20} />
                <span className="text-sm text-gray-500">案件単価</span>
              </div>
              <p className="text-3xl font-bold text-green-600">
                {stats.totalCampaigns > 0 ? formatCurrency(stats.totalSpent / stats.totalCampaigns) : '-'}
              </p>
              <p className="text-xs text-gray-400 mt-1">1案件あたり</p>
            </div>

            <div className="p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl border border-purple-100/50">
              <div className="flex items-center gap-3 mb-2">
                <Star className="text-purple-500" size={20} />
                <span className="text-sm text-gray-500">エンゲージメント率</span>
              </div>
              <p className="text-3xl font-bold text-purple-600">
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
