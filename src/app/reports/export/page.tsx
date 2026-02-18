'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Campaign } from '@/types';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { useToast, translateError } from '@/lib/toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  Loader2,
  FileSpreadsheet,
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  DollarSign,
  Heart,
  Target,
  ArrowLeft,
  Settings,
  Printer,
} from 'lucide-react';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';

type ReportType = 'monthly' | 'weekly' | 'custom' | 'influencer';

interface ReportConfig {
  type: ReportType;
  startDate: string;
  endDate: string;
  includeCharts: boolean;
  includeDetails: boolean;
  includeSummary: boolean;
  selectedBrands: string[];
  selectedStatuses: string[];
}

export default function ReportExportPage() {
  const { user, loading: authLoading } = useAuth();
  const { currentBrand } = useBrand();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [brands, setBrands] = useState<string[]>([]);

  const [config, setConfig] = useState<ReportConfig>({
    type: 'monthly',
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    includeCharts: true,
    includeDetails: true,
    includeSummary: true,
    selectedBrands: [],
    selectedStatuses: [],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*, influencer:influencers(*)')
        .eq('brand', currentBrand)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCampaigns(data || []);

      // ブランド一覧を抽出
      const uniqueBrands = Array.from(new Set((data || []).map(c => c.brand).filter(Boolean))) as string[];
      setBrands(uniqueBrands);
    } catch (err) {
      showToast('error', translateError(err));
    } finally {
      setLoading(false);
    }
  }, [showToast, currentBrand]);

  useEffect(() => {
    if (user && currentBrand) {
      fetchData();
    }
  }, [user, currentBrand, fetchData]);

  // 期間プリセット
  const setDatePreset = (preset: 'thisMonth' | 'lastMonth' | 'last3Months' | 'last6Months') => {
    const now = new Date();
    switch (preset) {
      case 'thisMonth':
        setConfig({
          ...config,
          startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        });
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        setConfig({
          ...config,
          startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
        });
        break;
      case 'last3Months':
        setConfig({
          ...config,
          startDate: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        });
        break;
      case 'last6Months':
        setConfig({
          ...config,
          startDate: format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        });
        break;
    }
  };

  // フィルタリングされたキャンペーン
  const filteredCampaigns = campaigns.filter(c => {
    const campaignDate = new Date(c.created_at);
    const startDate = new Date(config.startDate);
    const endDate = new Date(config.endDate);
    endDate.setHours(23, 59, 59);

    if (campaignDate < startDate || campaignDate > endDate) return false;
    if (config.selectedBrands.length > 0 && !config.selectedBrands.includes(c.brand || '')) return false;
    if (config.selectedStatuses.length > 0 && !config.selectedStatuses.includes(c.status)) return false;

    return true;
  });

  // サマリー計算
  const summary = {
    totalCampaigns: filteredCampaigns.length,
    agreedCampaigns: filteredCampaigns.filter(c => c.status === 'agree').length,
    totalSpent: filteredCampaigns.reduce((sum, c) => sum + (c.agreed_amount || 0), 0),
    totalLikes: filteredCampaigns.reduce((sum, c) => sum + (c.likes || 0), 0),
    totalComments: filteredCampaigns.reduce((sum, c) => sum + (c.comments || 0), 0),
    avgCostPerLike: 0,
    agreementRate: 0,
  };

  summary.avgCostPerLike = summary.totalLikes > 0 ? summary.totalSpent / summary.totalLikes : 0;
  summary.agreementRate = summary.totalCampaigns > 0 ? (summary.agreedCampaigns / summary.totalCampaigns) * 100 : 0;

  // CSVエクスポート
  const exportCSV = () => {
    const headers = [
      'インフルエンサー',
      'ブランド',
      '品番',
      '提示額',
      '合意額',
      'ステータス',
      '投稿日',
      'いいね数',
      'コメント数',
      'いいね単価',
    ];

    const rows = filteredCampaigns.map(c => [
      c.influencer?.insta_name || c.influencer?.tiktok_name || '',
      c.brand || '',
      c.item_code || '',
      c.offered_amount || 0,
      c.agreed_amount || 0,
      c.status === 'agree' ? '合意' : c.status === 'disagree' ? '不合意' : '保留',
      c.post_date || '',
      c.likes || 0,
      c.comments || 0,
      c.likes && c.agreed_amount ? Math.round(c.agreed_amount / c.likes) : 0,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell =>
        typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
      ).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report_${config.startDate}_${config.endDate}.csv`;
    link.click();
    showToast('success', 'CSVファイルをダウンロードしました');
  };

  // HTMLレポート生成（印刷用）
  const generatePrintableReport = () => {
    setGenerating(true);

    const reportWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!reportWindow) {
      showToast('error', 'ポップアップがブロックされました');
      setGenerating(false);
      return;
    }
    reportWindow.opener = null;

    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>インフルエンサーギフティング レポート</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Kaku Gothic Pro', 'Yu Gothic', sans-serif; padding: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #2563eb; }
    .header h1 { font-size: 24px; color: #2563eb; margin-bottom: 8px; }
    .header p { color: #666; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
    .summary-card { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; }
    .summary-card h3 { font-size: 12px; color: #666; margin-bottom: 8px; }
    .summary-card .value { font-size: 24px; font-weight: bold; color: #2563eb; }
    .section { margin-bottom: 40px; }
    .section h2 { font-size: 18px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f8fafc; font-weight: 600; }
    .status-agree { color: #16a34a; }
    .status-disagree { color: #dc2626; }
    .status-pending { color: #d97706; }
    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
    @media print {
      body { padding: 20px; }
      .summary { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>インフルエンサーギフティング レポート</h1>
    <p>${format(new Date(config.startDate), 'yyyy年M月d日', { locale: ja })} 〜 ${format(new Date(config.endDate), 'yyyy年M月d日', { locale: ja })}</p>
  </div>

  ${config.includeSummary ? `
  <div class="summary">
    <div class="summary-card">
      <h3>総キャンペーン数</h3>
      <div class="value">${summary.totalCampaigns.toLocaleString()}</div>
    </div>
    <div class="summary-card">
      <h3>合意率</h3>
      <div class="value">${summary.agreementRate.toFixed(1)}%</div>
    </div>
    <div class="summary-card">
      <h3>総支出額</h3>
      <div class="value">¥${summary.totalSpent.toLocaleString()}</div>
    </div>
    <div class="summary-card">
      <h3>総いいね数</h3>
      <div class="value">${summary.totalLikes.toLocaleString()}</div>
    </div>
  </div>

  <div class="section">
    <h2>KPI サマリー</h2>
    <table>
      <tr>
        <td>平均いいね単価</td>
        <td><strong>¥${Math.round(summary.avgCostPerLike).toLocaleString()}</strong></td>
      </tr>
      <tr>
        <td>総コメント数</td>
        <td><strong>${summary.totalComments.toLocaleString()}</strong></td>
      </tr>
      <tr>
        <td>合意キャンペーン数</td>
        <td><strong>${summary.agreedCampaigns}件</strong></td>
      </tr>
    </table>
  </div>
  ` : ''}

  ${config.includeDetails ? `
  <div class="section">
    <h2>キャンペーン詳細</h2>
    <table>
      <thead>
        <tr>
          <th>インフルエンサー</th>
          <th>ブランド</th>
          <th>合意額</th>
          <th>ステータス</th>
          <th>いいね</th>
          <th>いいね単価</th>
        </tr>
      </thead>
      <tbody>
        ${filteredCampaigns.map(c => `
          <tr>
            <td>@${c.influencer?.insta_name || c.influencer?.tiktok_name || '不明'}</td>
            <td>${c.brand || '-'}</td>
            <td>¥${(c.agreed_amount || 0).toLocaleString()}</td>
            <td class="status-${c.status}">${c.status === 'agree' ? '合意' : c.status === 'disagree' ? '不合意' : '保留'}</td>
            <td>${(c.likes || 0).toLocaleString()}</td>
            <td>${c.likes && c.agreed_amount ? '¥' + Math.round(c.agreed_amount / c.likes).toLocaleString() : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>生成日時: ${format(new Date(), 'yyyy年M月d日 HH:mm', { locale: ja })}</p>
  </div>
</body>
</html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();

    setTimeout(() => {
      setGenerating(false);
      showToast('success', 'レポートを生成しました（印刷またはPDF保存してください）');
    }, 500);
  };

  if (authLoading) {
    return <LoadingSpinner fullScreen message="認証中..." />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/reports" className="p-2 hover:bg-muted dark:hover:bg-gray-800 rounded-lg">
              <ArrowLeft size={20} className="text-muted-foreground dark:text-muted-foreground" />
            </Link>
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/30">
              <FileText className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground dark:text-white">レポート作成</h1>
              <p className="text-muted-foreground dark:text-muted-foreground mt-0.5">カスタムレポートの生成・エクスポート</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 設定パネル */}
          <div className="lg:col-span-1 space-y-6">
            {/* レポートタイプ */}
            <div className="card">
              <h3 className="font-bold text-foreground dark:text-white mb-4 flex items-center gap-2">
                <Settings size={18} className="text-muted-foreground" />
                レポート設定
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-2">
                    期間プリセット
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDatePreset('thisMonth')}
                      className="btn-secondary text-sm"
                    >
                      今月
                    </button>
                    <button
                      onClick={() => setDatePreset('lastMonth')}
                      className="btn-secondary text-sm"
                    >
                      先月
                    </button>
                    <button
                      onClick={() => setDatePreset('last3Months')}
                      className="btn-secondary text-sm"
                    >
                      過去3ヶ月
                    </button>
                    <button
                      onClick={() => setDatePreset('last6Months')}
                      className="btn-secondary text-sm"
                    >
                      過去6ヶ月
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">
                      開始日
                    </label>
                    <input
                      type="date"
                      value={config.startDate}
                      onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">
                      終了日
                    </label>
                    <input
                      type="date"
                      value={config.endDate}
                      onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-2">
                    ブランドフィルター
                  </label>
                  <select
                    multiple
                    value={config.selectedBrands}
                    onChange={(e) => setConfig({
                      ...config,
                      selectedBrands: Array.from(e.target.selectedOptions, o => o.value)
                    })}
                    className="input-field h-24"
                  >
                    {brands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Ctrl/Cmd + クリックで複数選択</p>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.includeSummary}
                      onChange={(e) => setConfig({ ...config, includeSummary: e.target.checked })}
                      className="rounded text-primary-600"
                    />
                    <span className="text-sm text-foreground dark:text-muted-foreground">サマリーを含める</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.includeDetails}
                      onChange={(e) => setConfig({ ...config, includeDetails: e.target.checked })}
                      className="rounded text-primary-600"
                    />
                    <span className="text-sm text-foreground dark:text-muted-foreground">詳細データを含める</span>
                  </label>
                </div>
              </div>
            </div>

            {/* エクスポートボタン */}
            <div className="card">
              <h3 className="font-bold text-foreground dark:text-white mb-4 flex items-center gap-2">
                <Download size={18} className="text-muted-foreground" />
                エクスポート
              </h3>

              <div className="space-y-3">
                <button
                  onClick={generatePrintableReport}
                  disabled={generating || filteredCampaigns.length === 0}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Printer size={18} />
                  )}
                  PDF/印刷用レポート
                </button>

                <button
                  onClick={exportCSV}
                  disabled={filteredCampaigns.length === 0}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet size={18} />
                  CSVダウンロード
                </button>
              </div>
            </div>
          </div>

          {/* プレビュー */}
          <div className="lg:col-span-2">
            <div className="card">
              <h3 className="font-bold text-foreground dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-muted-foreground" />
                レポートプレビュー
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {filteredCampaigns.length}件のキャンペーン
                </span>
              </h3>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-muted-foreground" size={32} />
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Filter size={40} className="mx-auto mb-3 opacity-50" />
                  <p>選択した条件に一致するキャンペーンがありません</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* サマリーカード */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="text-blue-500" size={18} />
                        <span className="text-sm text-muted-foreground dark:text-muted-foreground">キャンペーン</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground dark:text-white">{summary.totalCampaigns}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="text-green-500" size={18} />
                        <span className="text-sm text-muted-foreground dark:text-muted-foreground">合意率</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground dark:text-white">{summary.agreementRate.toFixed(1)}%</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="text-purple-500" size={18} />
                        <span className="text-sm text-muted-foreground dark:text-muted-foreground">総支出</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground dark:text-white">¥{summary.totalSpent.toLocaleString()}</p>
                    </div>
                    <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="text-pink-500" size={18} />
                        <span className="text-sm text-muted-foreground dark:text-muted-foreground">いいね単価</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground dark:text-white">¥{Math.round(summary.avgCostPerLike).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* 詳細テーブル */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border dark:border-gray-700">
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground dark:text-muted-foreground">インフルエンサー</th>
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground dark:text-muted-foreground">ブランド</th>
                          <th className="text-right py-3 px-2 font-medium text-muted-foreground dark:text-muted-foreground">合意額</th>
                          <th className="text-center py-3 px-2 font-medium text-muted-foreground dark:text-muted-foreground">ステータス</th>
                          <th className="text-right py-3 px-2 font-medium text-muted-foreground dark:text-muted-foreground">いいね</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCampaigns.slice(0, 10).map(c => (
                          <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-3 px-2">
                              <span className="font-medium text-foreground dark:text-white">
                                @{c.influencer?.insta_name || c.influencer?.tiktok_name || '不明'}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-muted-foreground dark:text-muted-foreground">{c.brand || '-'}</td>
                            <td className="py-3 px-2 text-right text-foreground dark:text-white">
                              ¥{(c.agreed_amount || 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                c.status === 'agree'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  : c.status === 'disagree'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              }`}>
                                {c.status === 'agree' ? '合意' : c.status === 'disagree' ? '不合意' : '保留'}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right text-foreground dark:text-white">
                              {(c.likes || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {filteredCampaigns.length > 10 && (
                      <p className="text-center text-sm text-muted-foreground mt-4">
                        他 {filteredCampaigns.length - 10} 件のキャンペーン...
                      </p>
                    )}
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
