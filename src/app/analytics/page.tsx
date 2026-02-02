'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Heart,
  MessageCircle,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Download,
  Filter,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Zap,
  Award,
  Users,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

interface ROIData {
  overall: {
    totalSpent: number;
    totalLikes: number;
    totalComments: number;
    costPerLike: number;
    costPerComment: number;
    costPerEngagement: number;
    avgCampaignCost: number;
    totalCampaigns: number;
    successRate: number;
  };
  byBrand: {
    brand: string;
    spent: number;
    likes: number;
    comments: number;
    campaigns: number;
    costPerLike: number;
    roi: number;
  }[];
  byItem: {
    item_code: string;
    spent: number;
    likes: number;
    comments: number;
    campaigns: number;
    costPerLike: number;
  }[];
  byInfluencer: {
    insta_name: string;
    spent: number;
    likes: number;
    comments: number;
    campaigns: number;
    costPerLike: number;
    efficiency: number;
  }[];
  monthly: {
    month: string;
    spent: number;
    likes: number;
    costPerLike: number;
    campaigns: number;
  }[];
  comparison: {
    current: { spent: number; likes: number; costPerLike: number };
    previous: { spent: number; likes: number; costPerLike: number };
    change: { spent: number; likes: number; costPerLike: number };
  };
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [roiData, setRoiData] = useState<ROIData | null>(null);
  const [dateRange, setDateRange] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [comparisonPeriod, setComparisonPeriod] = useState<string>('month');
  const [brands, setBrands] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchROIData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dateRange, selectedBrand, comparisonPeriod]);

  useEffect(() => {
    const fetchBrands = async () => {
      const { data } = await supabase.from('campaigns').select('brand');
      if (data) {
        setBrands(Array.from(new Set(data.map(c => c.brand).filter(Boolean))) as string[]);
      }
    };
    fetchBrands();
  }, []);

  const fetchROIData = async () => {
    setLoading(true);

    let query = supabase
      .from('campaigns')
      .select('*, influencer:influencers(*)');

    if (selectedBrand !== 'all') {
      query = query.eq('brand', selectedBrand);
    }

    // 日付フィルター
    const now = new Date();
    let startDate: Date | null = null;
    let previousStartDate: Date | null = null;
    let previousEndDate: Date | null = null;

    switch (dateRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        previousEndDate = startDate;
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        previousEndDate = startDate;
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        previousEndDate = startDate;
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
        previousEndDate = startDate;
        break;
    }

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data: campaigns } = await query;

    // 比較期間のデータ取得
    let previousCampaigns: any[] = [];
    if (previousStartDate && previousEndDate) {
      let prevQuery = supabase
        .from('campaigns')
        .select('*')
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', previousEndDate.toISOString());

      if (selectedBrand !== 'all') {
        prevQuery = prevQuery.eq('brand', selectedBrand);
      }

      const { data } = await prevQuery;
      previousCampaigns = data || [];
    }

    if (campaigns) {
      // 全体ROI計算
      const totalSpent = campaigns.reduce((sum, c) => sum + (c.agreed_amount || 0), 0);
      const totalLikes = campaigns.reduce((sum, c) => sum + (c.likes || 0), 0);
      const totalComments = campaigns.reduce((sum, c) => sum + (c.comments || 0), 0);
      const agreedCampaigns = campaigns.filter(c => c.status === 'agree').length;

      // ブランド別集計
      const brandMap = new Map<string, any>();
      campaigns.forEach(c => {
        const brand = c.brand || '未設定';
        const existing = brandMap.get(brand) || { spent: 0, likes: 0, comments: 0, campaigns: 0 };
        brandMap.set(brand, {
          spent: existing.spent + (c.agreed_amount || 0),
          likes: existing.likes + (c.likes || 0),
          comments: existing.comments + (c.comments || 0),
          campaigns: existing.campaigns + 1,
        });
      });

      // 商品別集計
      const itemMap = new Map<string, any>();
      campaigns.forEach(c => {
        if (c.item_code) {
          const existing = itemMap.get(c.item_code) || { spent: 0, likes: 0, comments: 0, campaigns: 0 };
          itemMap.set(c.item_code, {
            spent: existing.spent + (c.agreed_amount || 0),
            likes: existing.likes + (c.likes || 0),
            comments: existing.comments + (c.comments || 0),
            campaigns: existing.campaigns + 1,
          });
        }
      });

      // インフルエンサー別集計
      const influencerMap = new Map<string, any>();
      campaigns.forEach(c => {
        if (c.influencer) {
          const key = c.influencer.insta_name;
          const existing = influencerMap.get(key) || { spent: 0, likes: 0, comments: 0, campaigns: 0 };
          influencerMap.set(key, {
            spent: existing.spent + (c.agreed_amount || 0),
            likes: existing.likes + (c.likes || 0),
            comments: existing.comments + (c.comments || 0),
            campaigns: existing.campaigns + 1,
          });
        }
      });

      // 月別集計
      const monthMap = new Map<string, any>();
      campaigns.forEach(c => {
        const month = (c.post_date || c.created_at).substring(0, 7);
        const existing = monthMap.get(month) || { spent: 0, likes: 0, campaigns: 0 };
        monthMap.set(month, {
          spent: existing.spent + (c.agreed_amount || 0),
          likes: existing.likes + (c.likes || 0),
          campaigns: existing.campaigns + 1,
        });
      });

      // 比較データ計算
      const prevSpent = previousCampaigns.reduce((sum, c) => sum + (c.agreed_amount || 0), 0);
      const prevLikes = previousCampaigns.reduce((sum, c) => sum + (c.likes || 0), 0);

      setRoiData({
        overall: {
          totalSpent,
          totalLikes,
          totalComments,
          costPerLike: totalLikes > 0 ? totalSpent / totalLikes : 0,
          costPerComment: totalComments > 0 ? totalSpent / totalComments : 0,
          costPerEngagement: (totalLikes + totalComments) > 0 ? totalSpent / (totalLikes + totalComments) : 0,
          avgCampaignCost: campaigns.length > 0 ? totalSpent / campaigns.length : 0,
          totalCampaigns: campaigns.length,
          successRate: campaigns.length > 0 ? (agreedCampaigns / campaigns.length) * 100 : 0,
        },
        byBrand: Array.from(brandMap.entries())
          .map(([brand, data]) => ({
            brand,
            ...data,
            costPerLike: data.likes > 0 ? data.spent / data.likes : 0,
            roi: data.spent > 0 ? (data.likes / data.spent) * 1000 : 0,
          }))
          .sort((a, b) => b.likes - a.likes),
        byItem: Array.from(itemMap.entries())
          .map(([item_code, data]) => ({
            item_code,
            ...data,
            costPerLike: data.likes > 0 ? data.spent / data.likes : 0,
          }))
          .sort((a, b) => b.likes - a.likes)
          .slice(0, 10),
        byInfluencer: Array.from(influencerMap.entries())
          .map(([insta_name, data]) => ({
            insta_name,
            ...data,
            costPerLike: data.likes > 0 ? data.spent / data.likes : 0,
            efficiency: data.spent > 0 ? (data.likes / data.spent) * 100 : 0,
          }))
          .sort((a, b) => a.costPerLike - b.costPerLike)
          .slice(0, 10),
        monthly: Array.from(monthMap.entries())
          .map(([month, data]) => ({
            month,
            ...data,
            costPerLike: data.likes > 0 ? data.spent / data.likes : 0,
          }))
          .sort((a, b) => a.month.localeCompare(b.month))
          .slice(-12),
        comparison: {
          current: {
            spent: totalSpent,
            likes: totalLikes,
            costPerLike: totalLikes > 0 ? totalSpent / totalLikes : 0,
          },
          previous: {
            spent: prevSpent,
            likes: prevLikes,
            costPerLike: prevLikes > 0 ? prevSpent / prevLikes : 0,
          },
          change: {
            spent: prevSpent > 0 ? ((totalSpent - prevSpent) / prevSpent) * 100 : 0,
            likes: prevLikes > 0 ? ((totalLikes - prevLikes) / prevLikes) * 100 : 0,
            costPerLike: prevLikes > 0 && totalLikes > 0
              ? (((totalSpent / totalLikes) - (prevSpent / prevLikes)) / (prevSpent / prevLikes)) * 100
              : 0,
          },
        },
      });
    }

    setLoading(false);
  };

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

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="relative">
              <Loader2 className="animate-spin mx-auto text-primary-500" size={48} />
              <Sparkles className="absolute -top-2 -right-2 text-yellow-400 animate-pulse" size={20} />
            </div>
            <p className="mt-4 text-gray-500">ROIデータを分析中...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!roiData) return null;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg shadow-green-500/30">
                <BarChart3 className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">ROI分析</h1>
                <p className="text-gray-500 mt-0.5">投資対効果の詳細分析</p>
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

            <button className="btn-primary flex items-center gap-2">
              <Download size={18} />
              レポート出力
            </button>
          </div>
        </div>

        {/* 期間比較サマリー */}
        {dateRange !== 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">支出額</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(roiData.comparison.current.spent)}
                  </p>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${
                    roiData.comparison.change.spent >= 0 ? 'text-red-500' : 'text-green-500'
                  }`}>
                    {roiData.comparison.change.spent >= 0 ? (
                      <ArrowUpRight size={16} />
                    ) : (
                      <ArrowDownRight size={16} />
                    )}
                    <span>{formatPercent(roiData.comparison.change.spent)}</span>
                    <span className="text-gray-400">vs 前期間</span>
                  </div>
                </div>
                <DollarSign className="text-blue-400" size={40} />
              </div>
            </div>

            <div className="card bg-gradient-to-br from-pink-50 to-rose-50 border-pink-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-pink-600 font-medium">獲得いいね</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatNumber(roiData.comparison.current.likes)}
                  </p>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${
                    roiData.comparison.change.likes >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {roiData.comparison.change.likes >= 0 ? (
                      <ArrowUpRight size={16} />
                    ) : (
                      <ArrowDownRight size={16} />
                    )}
                    <span>{formatPercent(roiData.comparison.change.likes)}</span>
                    <span className="text-gray-400">vs 前期間</span>
                  </div>
                </div>
                <Heart className="text-pink-400" size={40} />
              </div>
            </div>

            <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">いいね単価</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(roiData.comparison.current.costPerLike)}
                  </p>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${
                    roiData.comparison.change.costPerLike <= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {roiData.comparison.change.costPerLike <= 0 ? (
                      <ArrowDownRight size={16} />
                    ) : (
                      <ArrowUpRight size={16} />
                    )}
                    <span>{formatPercent(roiData.comparison.change.costPerLike)}</span>
                    <span className="text-gray-400">vs 前期間</span>
                  </div>
                </div>
                <Target className="text-green-400" size={40} />
              </div>
            </div>
          </div>
        )}

        {/* KPI詳細 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="stat-card">
            <p className="text-xs text-gray-500">総支出</p>
            <p className="text-xl font-bold gradient-text">{formatCurrency(roiData.overall.totalSpent)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">総いいね</p>
            <p className="text-xl font-bold text-pink-600">{formatNumber(roiData.overall.totalLikes)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">いいね単価</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(roiData.overall.costPerLike)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">コメント単価</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(roiData.overall.costPerComment)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">案件平均</p>
            <p className="text-xl font-bold text-purple-600">{formatCurrency(roiData.overall.avgCampaignCost)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">成功率</p>
            <p className="text-xl font-bold text-amber-600">{roiData.overall.successRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* グラフエリア */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 月別ROI推移 */}
          <div className="card lg:col-span-2">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="text-green-500" size={20} />
              月別ROI推移
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={roiData.monthly}>
                  <defs>
                    <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
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
                      if (name === '支出額' || name === 'いいね単価') return formatCurrency(value);
                      return formatNumber(value);
                    }}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="spent"
                    fill="url(#colorSpent)"
                    stroke="#8b5cf6"
                    name="支出額"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="costPerLike"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2 }}
                    name="いいね単価"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ブランド別ROI */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
              <PieChartIcon className="text-purple-500" size={20} />
              ブランド別支出構成
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roiData.byBrand}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="spent"
                    nameKey="brand"
                  >
                    {roiData.byBrand.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {roiData.byBrand.slice(0, 6).map((item, index) => (
                <div key={item.brand} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-gray-600">{item.brand}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ブランド別効率 */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Zap className="text-amber-500" size={20} />
              ブランド別効率（いいね単価）
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roiData.byBrand.slice(0, 6)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="brand" width={60} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar dataKey="costPerLike" fill="#10b981" radius={[0, 4, 4, 0]} name="いいね単価" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* インフルエンサー効率ランキング */}
        <div className="card">
          <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Award className="text-yellow-500" size={20} />
            コスパ優秀インフルエンサー TOP10
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header px-4 py-3">順位</th>
                  <th className="table-header px-4 py-3">インフルエンサー</th>
                  <th className="table-header px-4 py-3">案件数</th>
                  <th className="table-header px-4 py-3">総支出</th>
                  <th className="table-header px-4 py-3">総いいね</th>
                  <th className="table-header px-4 py-3">いいね単価</th>
                  <th className="table-header px-4 py-3">効率スコア</th>
                </tr>
              </thead>
              <tbody>
                {roiData.byInfluencer.map((inf, index) => (
                  <tr key={inf.insta_name} className="table-row">
                    <td className="table-cell">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-100 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="table-cell font-medium">@{inf.insta_name}</td>
                    <td className="table-cell">{inf.campaigns}件</td>
                    <td className="table-cell">{formatCurrency(inf.spent)}</td>
                    <td className="table-cell text-pink-600 font-medium">{formatNumber(inf.likes)}</td>
                    <td className="table-cell">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        {formatCurrency(inf.costPerLike)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                            style={{ width: `${Math.min(inf.efficiency, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-12">{inf.efficiency.toFixed(1)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 商品別分析 */}
        <div className="card">
          <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
            <BarChart3 className="text-indigo-500" size={20} />
            商品別ROI分析
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roiData.byItem}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="item_code" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === '支出' || name === 'いいね単価') return formatCurrency(value);
                    return formatNumber(value);
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="likes" fill="#ec4899" name="いいね" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="spent" fill="#8b5cf6" name="支出" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="costPerLike" stroke="#10b981" strokeWidth={2} name="いいね単価" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
