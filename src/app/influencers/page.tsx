'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Influencer } from '@/types';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast, translateError } from '@/lib/toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import LoadingSpinner, { CardSkeleton } from '@/components/ui/LoadingSpinner';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import { useBrand } from '@/contexts/BrandContext';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Instagram,
  Heart,
  DollarSign,
  Award,
  BarChart3,
  SortAsc,
  SortDesc,
  Crown,
  Medal,
  Users,
} from 'lucide-react';
import InfluencerModal from '@/components/forms/InfluencerModal';

interface InfluencerWithScore extends Influencer {
  totalCampaigns: number;
  totalLikes: number;
  totalComments: number;
  totalSpent: number;
  costPerLike: number;
  avgEngagement: number;
  score: number;
  rank: string;
  lastActivity?: string;
}

export default function InfluencersPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { currentBrand } = useBrand();
  const [influencers, setInfluencers] = useState<InfluencerWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInfluencer, setEditingInfluencer] = useState<Influencer | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [sortBy, setSortBy] = useState<'score' | 'likes' | 'cost' | 'campaigns'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchInfluencersWithScores = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // インフルエンサーと案件を取得（ブランドでフィルター）
      // brandカラムが存在しない場合のフォールバック
      let influencersRes = await supabase.from('influencers').select('*').eq('brand', currentBrand).order('created_at', { ascending: false });
      if (influencersRes.error && influencersRes.error.message.includes('brand')) {
        influencersRes = await supabase.from('influencers').select('*').order('created_at', { ascending: false });
      }

      const campaignsRes = await supabase.from('campaigns').select('*').eq('brand', currentBrand);

      if (influencersRes.error) throw influencersRes.error;
      if (campaignsRes.error) throw campaignsRes.error;

      const influencersData = influencersRes.data;
      const campaignsData = campaignsRes.data;

    if (influencersData) {
      // インフルエンサーごとにスコア計算
      const scoredInfluencers: InfluencerWithScore[] = influencersData.map(inf => {
        const campaigns = campaignsData.filter(c => c.influencer_id === inf.id);
        const totalCampaigns = campaigns.length;
        const agreedCampaigns = campaigns.filter(c => c.status === 'agree').length;
        const totalLikes = campaigns.reduce((sum, c) => sum + (c.likes || 0), 0);
        const totalComments = campaigns.reduce((sum, c) => sum + (c.comments || 0), 0);
        const totalSpent = campaigns.reduce((sum, c) => sum + (c.agreed_amount || 0), 0);
        const costPerLike = totalLikes > 0 ? totalSpent / totalLikes : 0;
        const avgLikes = totalCampaigns > 0 ? totalLikes / totalCampaigns : 0;
        const avgEngagement = totalCampaigns > 0 ? (totalLikes + totalComments) / totalCampaigns : 0;
        const agreementRate = totalCampaigns > 0 ? (agreedCampaigns / totalCampaigns) * 100 : 0;

        // 納期遵守率を計算
        const campaignsWithDeadline = campaigns.filter(c => c.desired_post_date && c.post_date);
        const onTimeCampaigns = campaignsWithDeadline.filter(c => {
          const desired = new Date(c.desired_post_date!);
          const actual = new Date(c.post_date!);
          return actual <= desired;
        });
        const onTimeRate = campaignsWithDeadline.length > 0
          ? (onTimeCampaigns.length / campaignsWithDeadline.length) * 100
          : 100;

        // 検討コメント数を計算
        const totalConsiderationComments = campaigns.reduce((sum, c) => sum + (c.consideration_comment || 0), 0);
        const avgConsiderationComments = totalCampaigns > 0 ? totalConsiderationComments / totalCampaigns : 0;

        // スコア計算（ギフティング向け・詳細ページと同じロジック）
        let score = 0;

        if (totalCampaigns > 0) {
          // 1. 検討コメントスコア（重み: 40%）- 最重要指標
          const considerationScore = Math.min(100, (avgConsiderationComments / 50) * 100);

          // 2. エンゲージメントスコア（重み: 25%）- 平均いいね数基準
          const engagementScore = Math.min(100, (avgLikes / 1000) * 100);

          // 3. コスト効率スコア（重み: 20%）- いいね単価基準
          const efficiencyScore = costPerLike > 0
            ? Math.max(0, Math.min(100, ((200 - costPerLike) / 150) * 100))
            : 50;

          // 4. 信頼性スコア（重み: 15%）- 納期遵守率のみ
          const reliabilityScore = onTimeRate;

          score = Math.round(
            considerationScore * 0.40 +
            engagementScore * 0.25 +
            efficiencyScore * 0.20 +
            reliabilityScore * 0.15
          );
        }

        // ランク判定
        let rank = 'C';
        if (score >= 75) rank = 'S';
        else if (score >= 55) rank = 'A';
        else if (score >= 35) rank = 'B';

        // 最終活動日
        const sortedCampaigns = [...campaigns].sort((a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        const lastActivity = sortedCampaigns[0]?.updated_at;

        return {
          ...inf,
          totalCampaigns,
          totalLikes,
          totalComments,
          totalSpent,
          costPerLike,
          avgEngagement,
          score,
          rank,
          lastActivity,
        };
      });

      setInfluencers(scoredInfluencers);
    }
    } catch (err) {
      const errorMessage = translateError(err);
      setError(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showToast, currentBrand]);

  useEffect(() => {
    if (user) {
      fetchInfluencersWithScores();
    }
  }, [user, fetchInfluencersWithScores]);

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'インフルエンサーの削除',
      message: 'このインフルエンサーを削除しますか？関連する案件も全て削除されます。',
      type: 'danger',
      confirmText: '削除',
      cancelText: 'キャンセル',
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('influencers').delete().eq('id', id);
      if (error) throw error;

      setInfluencers(influencers.filter((i) => i.id !== id));
      showToast('success', 'インフルエンサーを削除しました');
    } catch (err) {
      showToast('error', translateError(err));
    }
  };

  const handleEdit = (influencer: Influencer) => {
    setEditingInfluencer(influencer);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingInfluencer(null);
  };

  const handleSave = () => {
    fetchInfluencersWithScores();
    handleModalClose();
    showToast('success', editingInfluencer ? 'インフルエンサーを更新しました' : 'インフルエンサーを追加しました');
  };

  const filteredAndSortedInfluencers = influencers
    .filter((i) => {
      const name = i.insta_name || i.tiktok_name || '';
      return name.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'score':
          comparison = a.score - b.score;
          break;
        case 'likes':
          comparison = a.totalLikes - b.totalLikes;
          break;
        case 'cost':
          comparison = a.costPerLike - b.costPerLike;
          break;
        case 'campaigns':
          comparison = a.totalCampaigns - b.totalCampaigns;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

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

  const getRankColor = (rank: string) => {
    switch (rank) {
      case 'S': return 'from-gray-900 to-gray-800 text-white';
      case 'A': return 'from-gray-700 to-gray-600 text-white';
      case 'B': return 'from-gray-500 to-gray-400 text-white';
      case 'C': return 'from-gray-400 to-gray-300 text-gray-800';
      default: return 'from-gray-300 to-gray-200 text-gray-700';
    }
  };

  const getRankBgColor = (rank: string) => {
    switch (rank) {
      case 'S': return 'bg-gray-50 border-gray-400';
      case 'A': return 'bg-gray-50 border-gray-300';
      case 'B': return 'bg-white border-gray-200';
      case 'C': return 'bg-white border-gray-200';
      default: return 'bg-white border-gray-200';
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
          onRetry={fetchInfluencersWithScores}
          showHomeLink
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-800 rounded-xl shadow-lg">
              <Users className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">インフルエンサー管理</h1>
              <p className="text-gray-500 mt-0.5">登録済み: {influencers.length}名 | スコアリング対応</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            新規追加
          </button>
        </div>

        {/* 統計サマリー */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-800 rounded-lg">
                <Crown className="text-white" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Sランク</p>
                <p className="text-xl font-bold text-gray-800">
                  {influencers.filter(i => i.rank === 'S').length}名
                </p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-600 rounded-lg">
                <Award className="text-white" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Aランク</p>
                <p className="text-xl font-bold text-gray-700">
                  {influencers.filter(i => i.rank === 'A').length}名
                </p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-500 rounded-lg">
                <Heart className="text-white" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">総いいね</p>
                <p className="text-xl font-bold text-gray-700">
                  {formatNumber(influencers.reduce((sum, i) => sum + i.totalLikes, 0))}
                </p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-400 rounded-lg">
                <DollarSign className="text-white" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">平均いいね単価</p>
                <p className="text-xl font-bold text-gray-700">
                  {formatCurrency(
                    influencers.reduce((sum, i) => sum + i.totalSpent, 0) /
                    Math.max(1, influencers.reduce((sum, i) => sum + i.totalLikes, 0))
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* フィルター＆ソート */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="インフルエンサーを検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input-field text-sm"
            >
              <option value="score">スコア順</option>
              <option value="likes">いいね数順</option>
              <option value="cost">コスパ順</option>
              <option value="campaigns">案件数順</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="btn-secondary p-2"
            >
              {sortOrder === 'desc' ? <SortDesc size={20} /> : <SortAsc size={20} />}
            </button>

            <button
              onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
              className="btn-secondary p-2"
            >
              <BarChart3 size={20} />
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        {loading ? (
          <CardSkeleton count={6} />
        ) : filteredAndSortedInfluencers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchTerm
              ? '検索結果がありません'
              : 'インフルエンサーが登録されていません'}
          </div>
        ) : viewMode === 'cards' ? (
          /* カードビュー */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedInfluencers.map((influencer, index) => (
              <div
                key={influencer.id}
                className={`card border-2 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${getRankBgColor(influencer.rank)}`}
              >
                {/* ヘッダー */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getRankColor(influencer.rank)} flex items-center justify-center font-bold text-lg shadow-lg`}>
                      {influencer.rank}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Instagram size={16} className="text-gray-600" />
                        <span className="font-bold text-gray-900">@{influencer.insta_name || influencer.tiktok_name}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        スコア: {influencer.score}/100
                      </p>
                    </div>
                  </div>
                  {index < 3 && (
                    <div className="flex items-center gap-1">
                      {index === 0 && <Crown className="text-gray-800" size={20} />}
                      {index === 1 && <Medal className="text-gray-500" size={20} />}
                      {index === 2 && <Medal className="text-gray-400" size={20} />}
                    </div>
                  )}
                </div>

                {/* スコアバー */}
                <div className="mb-4">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${
                        influencer.rank === 'S' ? 'from-gray-800 to-gray-700' :
                        influencer.rank === 'A' ? 'from-gray-700 to-gray-600' :
                        influencer.rank === 'B' ? 'from-gray-500 to-gray-400' :
                        'from-gray-400 to-gray-300'
                      } rounded-full transition-all duration-500`}
                      style={{ width: `${influencer.score}%` }}
                    />
                  </div>
                </div>

                {/* 統計 */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-2 bg-white/60 rounded-lg">
                    <p className="text-xs text-gray-500">案件数</p>
                    <p className="font-bold text-gray-900">{influencer.totalCampaigns}件</p>
                  </div>
                  <div className="p-2 bg-white/60 rounded-lg">
                    <p className="text-xs text-gray-500">総いいね</p>
                    <p className="font-bold text-gray-800">{formatNumber(influencer.totalLikes)}</p>
                  </div>
                  <div className="p-2 bg-white/60 rounded-lg">
                    <p className="text-xs text-gray-500">総支出</p>
                    <p className="font-bold text-gray-900">{formatCurrency(influencer.totalSpent)}</p>
                  </div>
                  <div className="p-2 bg-white/60 rounded-lg">
                    <p className="text-xs text-gray-500">いいね単価</p>
                    <p className={`font-bold ${influencer.costPerLike < 100 ? 'text-gray-800' : 'text-gray-600'}`}>
                      {influencer.costPerLike > 0 ? formatCurrency(influencer.costPerLike) : '-'}
                    </p>
                  </div>
                </div>

                {/* アクション */}
                <div className="flex gap-2">
                  {influencer.insta_url && (
                    <a
                      href={influencer.insta_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary flex-1 text-center text-sm"
                    >
                      Instagram
                    </a>
                  )}
                  <button
                    onClick={() => handleEdit(influencer)}
                    className="p-2 text-gray-600 hover:bg-white rounded-lg transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(influencer.id)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* テーブルビュー */
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header px-4 py-3">ランク</th>
                    <th className="table-header px-4 py-3">Instagram名</th>
                    <th className="table-header px-4 py-3">スコア</th>
                    <th className="table-header px-4 py-3">案件数</th>
                    <th className="table-header px-4 py-3">総いいね</th>
                    <th className="table-header px-4 py-3">総支出</th>
                    <th className="table-header px-4 py-3">いいね単価</th>
                    <th className="table-header px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedInfluencers.map((influencer) => (
                    <tr key={influencer.id} className="table-row">
                      <td className="table-cell">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r ${getRankColor(influencer.rank)}`}>
                          {influencer.rank}
                        </span>
                      </td>
                      <td className="table-cell font-medium">
                        <div className="flex items-center gap-2">
                          <Instagram size={16} className="text-gray-600" />
                          @{influencer.insta_name || influencer.tiktok_name}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden w-16">
                            <div
                              className="h-full bg-primary-500 rounded-full"
                              style={{ width: `${influencer.score}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{influencer.score}</span>
                        </div>
                      </td>
                      <td className="table-cell">{influencer.totalCampaigns}件</td>
                      <td className="table-cell text-gray-800 font-medium">
                        {formatNumber(influencer.totalLikes)}
                      </td>
                      <td className="table-cell">{formatCurrency(influencer.totalSpent)}</td>
                      <td className="table-cell">
                        <span className={`px-2 py-1 rounded-full text-sm ${
                          influencer.costPerLike < 50 ? 'bg-gray-800 text-white' :
                          influencer.costPerLike < 100 ? 'bg-gray-200 text-gray-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {influencer.costPerLike > 0 ? formatCurrency(influencer.costPerLike) : '-'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(influencer)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(influencer.id)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* モーダル */}
      {isModalOpen && (
        <InfluencerModal
          influencer={editingInfluencer}
          onClose={handleModalClose}
          onSave={handleSave}
        />
      )}
    </MainLayout>
  );
}
