'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Heart,
  MessageCircle,
  Target,
  BarChart3,
  Calendar,
  Download,
  Filter,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import type { ROIData } from './types';
import { formatCurrency, formatNumber, formatPercent } from './utils';

const AnalyticsCharts = dynamic(() => import('./AnalyticsCharts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card lg:col-span-2">
        <div className="h-80 skeleton" />
      </div>
      <div className="card">
        <div className="h-64 skeleton" />
      </div>
      <div className="card">
        <div className="h-64 skeleton" />
      </div>
      <div className="card">
        <div className="h-64 skeleton" />
      </div>
    </div>
  ),
});

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const { currentBrand } = useBrand();
  const [loading, setLoading] = useState(true);
  const [roiData, setRoiData] = useState<ROIData | null>(null);
  const [dateRange, setDateRange] = useState<string>('all');
  const [comparisonPeriod, setComparisonPeriod] = useState<string>('month');

  useEffect(() => {
    if (user) {
      fetchROIData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dateRange, currentBrand, comparisonPeriod]);

  const fetchROIData = async () => {
    setLoading(true);

    let query = supabase
      .from('campaigns')
      .select('*, influencer:influencers(*)')
      .eq('brand', currentBrand); // 常に現在のブランドでフィルター

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
    interface CampaignData {
      id: string;
      brand: string | null;
      item_code: string | null;
      status: string;
      agreed_amount: number | null;
      product_cost: number | null;
      item_quantity: number | null;
      shipping_cost: number | null;
      is_international_shipping: boolean | null;
      international_shipping_cost: number | null;
      likes: number | null;
      comments: number | null;
      influencer?: {
        id: string;
        insta_name: string | null;
        tiktok_name: string | null;
      } | null;
      created_at: string;
    }
    let previousCampaigns: CampaignData[] = [];
    if (previousStartDate && previousEndDate) {
      let prevQuery = supabase
        .from('campaigns')
        .select('*')
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', previousEndDate.toISOString());

      prevQuery = prevQuery.eq('brand', currentBrand);

      const { data } = await prevQuery;
      previousCampaigns = data || [];
    }

    if (campaigns) {
      const calcCampaignCost = (c: any): number => {
        const agreed = Number(c?.agreed_amount || 0);
        const unitCost = Number(c?.product_cost || 0);
        const qty = Math.max(1, Number(c?.item_quantity || 1));

        const shippingRaw = c?.shipping_cost;
        const shipping =
          typeof shippingRaw === 'number'
            ? shippingRaw
            : shippingRaw === null || shippingRaw === undefined
              ? 800
              : Number.isFinite(Number(shippingRaw))
                ? Number(shippingRaw)
                : 800;

        const intl = c?.is_international_shipping ? Number(c?.international_shipping_cost || 0) : 0;

        const total = agreed + unitCost * qty + shipping + intl;
        return Number.isFinite(total) ? total : 0;
      };

      // 全体ROI計算
      const totalSpent = campaigns.reduce((sum, c) => sum + calcCampaignCost(c), 0);
      const totalLikes = campaigns.reduce((sum, c) => sum + (c.likes || 0), 0);
      const totalComments = campaigns.reduce((sum, c) => sum + (c.comments || 0), 0);
      const agreedCampaigns = campaigns.filter(c => c.status === 'agree').length;

      // ブランド別集計
      const brandMap = new Map<string, { spent: number; likes: number; comments: number; campaigns: number }>();
      campaigns.forEach(c => {
        const brand = c.brand || '未設定';
        const existing = brandMap.get(brand) || { spent: 0, likes: 0, comments: 0, campaigns: 0 };
        brandMap.set(brand, {
          spent: existing.spent + calcCampaignCost(c),
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
            spent: existing.spent + calcCampaignCost(c),
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
          const displayName = c.influencer.insta_name || c.influencer.tiktok_name || '不明';
          const key = displayName;
          const existing = influencerMap.get(key) || { spent: 0, likes: 0, comments: 0, campaigns: 0 };
          influencerMap.set(key, {
            spent: existing.spent + calcCampaignCost(c),
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
          spent: existing.spent + calcCampaignCost(c),
          likes: existing.likes + (c.likes || 0),
          campaigns: existing.campaigns + 1,
        });
      });

      // 比較データ計算
      const prevSpent = previousCampaigns.reduce((sum, c) => sum + calcCampaignCost(c), 0);
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

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="relative">
              <Loader2 className="animate-spin mx-auto text-primary-500" size={48} />
              <Sparkles className="absolute -top-2 -right-2 text-yellow-400 animate-pulse" size={20} />
            </div>
            <p className="mt-4 text-muted-foreground">ROIデータを分析中...</p>
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
                <h1 className="text-2xl font-bold text-foreground">ROI分析</h1>
                <p className="text-muted-foreground mt-0.5">投資対効果の詳細分析</p>
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
                  <p className="text-2xl font-bold text-foreground mt-1">
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
                    <span className="text-muted-foreground">vs 前期間</span>
                  </div>
                </div>
                <DollarSign className="text-blue-400" size={40} />
              </div>
            </div>

            <div className="card bg-gradient-to-br from-pink-50 to-rose-50 border-pink-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-pink-600 font-medium">獲得いいね</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
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
                    <span className="text-muted-foreground">vs 前期間</span>
                  </div>
                </div>
                <Heart className="text-pink-400" size={40} />
              </div>
            </div>

            <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">いいね単価</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
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
                    <span className="text-muted-foreground">vs 前期間</span>
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
            <p className="text-xs text-muted-foreground">総コスト</p>
            <p className="text-xl font-bold gradient-text">{formatCurrency(roiData.overall.totalSpent)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">総いいね</p>
            <p className="text-xl font-bold text-pink-600">{formatNumber(roiData.overall.totalLikes)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">いいね単価</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(roiData.overall.costPerLike)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">コメント単価</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(roiData.overall.costPerComment)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">案件平均</p>
            <p className="text-xl font-bold text-purple-600">{formatCurrency(roiData.overall.avgCampaignCost)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">成功率</p>
            <p className="text-xl font-bold text-amber-600">{roiData.overall.successRate.toFixed(1)}%</p>
          </div>
        </div>

        <AnalyticsCharts roiData={roiData} />
      </div>
    </MainLayout>
  );
}
