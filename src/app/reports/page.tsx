'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import {
  FileText,
  Download,
  FileSpreadsheet,
  Filter,
  Calendar,
  Loader2,
  CheckCircle,
  Eye,
  Sparkles,
  BarChart3,
  Users,
  Gift,
  TrendingUp,
  Heart,
} from 'lucide-react';

interface ReportConfig {
  type: 'summary' | 'detailed' | 'influencer' | 'brand' | 'roi';
  dateFrom: string;
  dateTo: string;
  brands: string[];
  items: string[];
  includeCharts: boolean;
  format: 'excel' | 'csv';
}

interface ReportData {
  campaigns: any[];
  influencers: any[];
  summary: {
    totalCampaigns: number;
    totalSpent: number;
    totalLikes: number;
    totalComments: number;
    avgCostPerLike: number;
    topInfluencers: any[];
    topBrands: any[];
  };
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { currentBrand } = useBrand();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<ReportData | null>(null);
  const [config, setConfig] = useState<ReportConfig>({
    type: 'summary',
    dateFrom: '',
    dateTo: '',
    brands: [],
    items: [],
    includeCharts: true,
    format: 'excel',
  });

  useEffect(() => {
    const fetchFilters = async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('item_code')
        .eq('brand', currentBrand);
      if (data) {
        setItems(Array.from(new Set(data.map(c => c.item_code).filter(Boolean))) as string[]);
      }
    };
    fetchFilters();
  }, [currentBrand]);

  const fetchReportData = async (): Promise<ReportData> => {
    let query = supabase
      .from('campaigns')
      .select('*, influencer:influencers(*)')
      .eq('brand', currentBrand); // 常に現在のブランドでフィルター

    if (config.dateFrom) {
      query = query.gte('created_at', config.dateFrom);
    }
    if (config.dateTo) {
      query = query.lte('created_at', config.dateTo + 'T23:59:59');
    }
    if (config.items.length > 0) {
      query = query.in('item_code', config.items);
    }

    const { data: campaigns } = await query;
    const { data: influencers } = await supabase.from('influencers').select('*').eq('brand', currentBrand);

    const campaignList = campaigns || [];
    const influencerList = influencers || [];

    // サマリー計算
    const totalSpent = campaignList.reduce((sum, c) => sum + (c.agreed_amount || 0), 0);
    const totalLikes = campaignList.reduce((sum, c) => sum + (c.likes || 0), 0);
    const totalComments = campaignList.reduce((sum, c) => sum + (c.comments || 0), 0);

    // トップインフルエンサー
    const influencerMap = new Map<string, any>();
    campaignList.forEach(c => {
      if (c.influencer) {
        const displayName = c.influencer.insta_name || c.influencer.tiktok_name || '不明';
        const key = displayName;
        const existing = influencerMap.get(key) || { spent: 0, likes: 0, campaigns: 0 };
        influencerMap.set(key, {
          insta_name: key,
          spent: existing.spent + (c.agreed_amount || 0),
          likes: existing.likes + (c.likes || 0),
          campaigns: existing.campaigns + 1,
        });
      }
    });

    // トップブランド
    const brandMap = new Map<string, any>();
    campaignList.forEach(c => {
      const brand = c.brand || '未設定';
      const existing = brandMap.get(brand) || { spent: 0, likes: 0, campaigns: 0 };
      brandMap.set(brand, {
        brand,
        spent: existing.spent + (c.agreed_amount || 0),
        likes: existing.likes + (c.likes || 0),
        campaigns: existing.campaigns + 1,
      });
    });

    return {
      campaigns: campaignList,
      influencers: influencerList,
      summary: {
        totalCampaigns: campaignList.length,
        totalSpent,
        totalLikes,
        totalComments,
        avgCostPerLike: totalLikes > 0 ? totalSpent / totalLikes : 0,
        topInfluencers: Array.from(influencerMap.values())
          .sort((a, b) => b.likes - a.likes)
          .slice(0, 5),
        topBrands: Array.from(brandMap.values())
          .sort((a, b) => b.spent - a.spent)
          .slice(0, 5),
      },
    };
  };

  const handlePreview = async () => {
    setLoading(true);
    const data = await fetchReportData();
    setPreviewData(data);
    setLoading(false);
  };

  const generateExcel = async (data: ReportData) => {
    // CSVとして生成（Excel互換）
    let csv = '';

    if (config.type === 'summary' || config.type === 'roi') {
      // サマリーレポート
      csv += 'ギフティングレポート サマリー\n';
      csv += `生成日時,${new Date().toLocaleString('ja-JP')}\n`;
      csv += `期間,${config.dateFrom || '開始日なし'} 〜 ${config.dateTo || '終了日なし'}\n\n`;

      csv += '【全体サマリー】\n';
      csv += '項目,値\n';
      csv += `総案件数,${data.summary.totalCampaigns}\n`;
      csv += `総支出,¥${data.summary.totalSpent.toLocaleString()}\n`;
      csv += `総いいね数,${data.summary.totalLikes.toLocaleString()}\n`;
      csv += `総コメント数,${data.summary.totalComments.toLocaleString()}\n`;
      csv += `平均いいね単価,¥${Math.round(data.summary.avgCostPerLike).toLocaleString()}\n\n`;

      csv += '【トップインフルエンサー】\n';
      csv += 'インスタ名,案件数,支出,いいね数\n';
      data.summary.topInfluencers.forEach(inf => {
        csv += `@${inf.insta_name},${inf.campaigns},¥${inf.spent.toLocaleString()},${inf.likes.toLocaleString()}\n`;
      });

      csv += '\n【トップブランド】\n';
      csv += 'ブランド,案件数,支出,いいね数\n';
      data.summary.topBrands.forEach(brand => {
        csv += `${brand.brand},${brand.campaigns},¥${brand.spent.toLocaleString()},${brand.likes.toLocaleString()}\n`;
      });
    }

    if (config.type === 'detailed' || config.type === 'summary') {
      csv += '\n\n【案件詳細】\n';
      csv += 'インフルエンサー,ブランド,品番,ステータス,合意額,投稿日,いいね,コメント,投稿URL\n';
      data.campaigns.forEach(c => {
        const displayName = c.influencer?.insta_name || c.influencer?.tiktok_name || '';
        csv += `@${displayName},${c.brand || ''},${c.item_code || ''},${c.status},¥${(c.agreed_amount || 0).toLocaleString()},${c.post_date || ''},${c.likes || 0},${c.comments || 0},${c.post_url || ''}\n`;
      });
    }

    if (config.type === 'influencer') {
      csv += '【インフルエンサー別レポート】\n';
      csv += 'インスタ名,TikTok,フォロワー,案件数,総支出,総いいね,いいね単価\n';

      const influencerStats = new Map<string, any>();
      data.campaigns.forEach(c => {
        if (c.influencer) {
          const key = c.influencer.id;
          const existing = influencerStats.get(key) || {
            ...c.influencer,
            campaigns: 0,
            spent: 0,
            likes: 0,
          };
          influencerStats.set(key, {
            ...existing,
            campaigns: existing.campaigns + 1,
            spent: existing.spent + (c.agreed_amount || 0),
            likes: existing.likes + (c.likes || 0),
          });
        }
      });

      Array.from(influencerStats.values())
        .sort((a, b) => b.likes - a.likes)
        .forEach(inf => {
          const costPerLike = inf.likes > 0 ? inf.spent / inf.likes : 0;
          const displayName = inf.insta_name || inf.tiktok_name || '不明';
          csv += `@${displayName},${inf.tiktok_name || ''},${inf.followers || ''},${inf.campaigns},¥${inf.spent.toLocaleString()},${inf.likes.toLocaleString()},¥${Math.round(costPerLike).toLocaleString()}\n`;
        });
    }

    if (config.type === 'brand') {
      csv += '【ブランド別レポート】\n';
      csv += 'ブランド,案件数,総支出,総いいね,総コメント,いいね単価,エンゲージメント率\n';

      const brandStats = new Map<string, any>();
      data.campaigns.forEach(c => {
        const brand = c.brand || '未設定';
        const existing = brandStats.get(brand) || { campaigns: 0, spent: 0, likes: 0, comments: 0 };
        brandStats.set(brand, {
          brand,
          campaigns: existing.campaigns + 1,
          spent: existing.spent + (c.agreed_amount || 0),
          likes: existing.likes + (c.likes || 0),
          comments: existing.comments + (c.comments || 0),
        });
      });

      Array.from(brandStats.values())
        .sort((a, b) => b.spent - a.spent)
        .forEach(b => {
          const costPerLike = b.likes > 0 ? b.spent / b.likes : 0;
          const engagementRate = b.likes > 0 ? ((b.comments / b.likes) * 100).toFixed(2) : 0;
          csv += `${b.brand},${b.campaigns},¥${b.spent.toLocaleString()},${b.likes.toLocaleString()},${b.comments.toLocaleString()},¥${Math.round(costPerLike).toLocaleString()},${engagementRate}%\n`;
        });
    }

    return csv;
  };

  const handleDownload = async () => {
    setGenerating(true);

    const data = previewData || await fetchReportData();
    const csv = await generateExcel(data);

    // BOMを追加してExcelで文字化けしないようにする
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gifting_report_${config.type}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setGenerating(false);
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

  const reportTypes = [
    { id: 'summary', name: 'サマリーレポート', icon: BarChart3, desc: '全体の概要と主要KPI' },
    { id: 'detailed', name: '詳細レポート', icon: FileText, desc: '全案件の詳細データ' },
    { id: 'influencer', name: 'インフルエンサー別', icon: Users, desc: 'インフルエンサーごとの成績' },
    { id: 'brand', name: 'ブランド別', icon: Gift, desc: 'ブランドごとのROI分析' },
    { id: 'roi', name: 'ROI分析', icon: TrendingUp, desc: '投資対効果の詳細分析' },
  ];

  if (authLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-primary-500" size={48} />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/30">
            <FileText className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">レポート生成</h1>
            <p className="text-gray-500 mt-0.5">カスタムレポートの作成とダウンロード</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 設定パネル */}
          <div className="lg:col-span-1 space-y-6">
            {/* レポートタイプ選択 */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText size={18} className="text-primary-500" />
                レポートタイプ
              </h3>
              <div className="space-y-2">
                {reportTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setConfig({ ...config, type: type.id as any })}
                    className={`w-full p-3 rounded-xl text-left transition-all duration-300 ${
                      config.type === type.id
                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <type.icon size={18} />
                      <div>
                        <p className="font-medium">{type.name}</p>
                        <p className={`text-xs ${config.type === type.id ? 'text-white/70' : 'text-gray-500'}`}>
                          {type.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 期間設定 */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar size={18} className="text-primary-500" />
                期間設定
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
                  <input
                    type="date"
                    value={config.dateFrom}
                    onChange={(e) => setConfig({ ...config, dateFrom: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
                  <input
                    type="date"
                    value={config.dateTo}
                    onChange={(e) => setConfig({ ...config, dateTo: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
            </div>

            {/* フィルター */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Filter size={18} className="text-primary-500" />
                フィルター
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">商品</label>
                  <select
                    multiple
                    value={config.items}
                    onChange={(e) => setConfig({
                      ...config,
                      items: Array.from(e.target.selectedOptions, option => option.value)
                    })}
                    className="input-field h-24"
                  >
                    {items.map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* アクションボタン */}
            <div className="flex gap-3">
              <button
                onClick={handlePreview}
                disabled={loading}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Eye size={18} />}
                プレビュー
              </button>
              <button
                onClick={handleDownload}
                disabled={generating}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {generating ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                ダウンロード
              </button>
            </div>
          </div>

          {/* プレビューパネル */}
          <div className="lg:col-span-2">
            <div className="card min-h-[600px]">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Eye size={18} className="text-primary-500" />
                レポートプレビュー
              </h3>

              {!previewData ? (
                <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                  <FileText size={64} className="mb-4 opacity-30" />
                  <p>「プレビュー」をクリックしてレポートを生成</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* サマリーカード */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                      <p className="text-xs text-blue-600 font-medium">総案件数</p>
                      <p className="text-2xl font-bold text-gray-900">{previewData.summary.totalCampaigns}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
                      <p className="text-xs text-green-600 font-medium">総支出</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(previewData.summary.totalSpent)}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl">
                      <p className="text-xs text-pink-600 font-medium">総いいね</p>
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(previewData.summary.totalLikes)}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl">
                      <p className="text-xs text-purple-600 font-medium">いいね単価</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(previewData.summary.avgCostPerLike)}</p>
                    </div>
                  </div>

                  {/* トップインフルエンサー */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Users size={16} className="text-purple-500" />
                      トップインフルエンサー
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">インスタ名</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium">案件数</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium">支出</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium">いいね</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.summary.topInfluencers.map((inf, i) => (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="py-2 px-3 font-medium">@{inf.insta_name}</td>
                              <td className="py-2 px-3 text-right">{inf.campaigns}</td>
                              <td className="py-2 px-3 text-right">{formatCurrency(inf.spent)}</td>
                              <td className="py-2 px-3 text-right text-pink-600">{formatNumber(inf.likes)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* トップブランド */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Gift size={16} className="text-pink-500" />
                      トップブランド
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">ブランド</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium">案件数</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium">支出</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium">いいね</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.summary.topBrands.map((brand, i) => (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="py-2 px-3 font-medium">{brand.brand}</td>
                              <td className="py-2 px-3 text-right">{brand.campaigns}</td>
                              <td className="py-2 px-3 text-right">{formatCurrency(brand.spent)}</td>
                              <td className="py-2 px-3 text-right text-pink-600">{formatNumber(brand.likes)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 案件サンプル */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">案件データ（{previewData.campaigns.length}件）</h4>
                    <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl">
                      ダウンロードするCSVには全{previewData.campaigns.length}件の詳細データが含まれます
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
