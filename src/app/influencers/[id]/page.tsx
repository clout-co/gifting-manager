'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Influencer, Campaign } from '@/types';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast, translateError } from '@/lib/toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useBrand } from '@/contexts/BrandContext';
import {
  ArrowLeft,
  Instagram,
  Heart,
  DollarSign,
  Award,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  MessageCircle,
  ExternalLink,
  Star,
  StarOff,
  Ban,
  CheckCircle,
  Clock,
  AlertTriangle,
  Target,
  Zap,
  Crown,
  Medal,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface InfluencerDetail extends Influencer {
  campaigns: Campaign[];
  stats: {
    totalCampaigns: number;
    agreedCampaigns: number;
    totalLikes: number;
    totalComments: number;
    totalSpent: number;
    avgLikes: number;
    avgCost: number;
    costPerLike: number;
    agreementRate: number;
    onTimeRate: number;
    score: number;
    rank: string;
  };
}

export default function InfluencerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { currentBrand } = useBrand();
  const [loading, setLoading] = useState(true);
  const [influencer, setInfluencer] = useState<InfluencerDetail | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isBlacklisted, setIsBlacklisted] = useState(false);

  const influencerId = params.id as string;

  const fetchInfluencer = useCallback(async () => {
    if (!influencerId) return;

    setLoading(true);
    try {
      // インフルエンサー情報を取得（ブランドも確認）
      let influencerRes = await supabase
        .from('influencers')
        .select('*')
        .eq('id', influencerId)
        .eq('brand', currentBrand)
        .single();

      // brandカラムが存在しない場合のフォールバック
      if (influencerRes.error && influencerRes.error.message.includes('brand')) {
        influencerRes = await supabase
          .from('influencers')
          .select('*')
          .eq('id', influencerId)
          .single();
      }

      const { data: influencerData, error: influencerError } = influencerRes;

      if (influencerError) {
        // ブランドが異なる場合はインフルエンサー一覧にリダイレクト
        if (influencerError.code === 'PGRST116') {
          showToast('error', 'このインフルエンサーは現在のブランドに属していません');
          router.push('/influencers');
          return;
        }
        throw influencerError;
      }

      // キャンペーン情報を取得
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('influencer_id', influencerId)
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      const campaigns = campaignsData || [];

      // 統計を計算
      const totalCampaigns = campaigns.length;
      const agreedCampaigns = campaigns.filter(c => c.status === 'agree').length;
      const totalLikes = campaigns.reduce((sum, c) => sum + (c.likes || 0), 0);
      const totalComments = campaigns.reduce((sum, c) => sum + (c.comments || 0), 0);
      const totalSpent = campaigns.reduce((sum, c) => sum + (c.agreed_amount || 0), 0);

      const avgLikes = totalCampaigns > 0 ? totalLikes / totalCampaigns : 0;
      const avgCost = totalCampaigns > 0 ? totalSpent / totalCampaigns : 0;
      const costPerLike = totalLikes > 0 ? totalSpent / totalLikes : 0;
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

      // スコア計算（ギフティング向け改良版）
      // 1. 検討コメントスコア（重み: 40%）- 最重要指標
      //    - 平均検討コメント数を基準に評価（50コメントで満点）
      const considerationScore = Math.min(100, (avgConsiderationComments / 50) * 100);

      // 2. エンゲージメントスコア（重み: 25%）
      //    - 平均いいね数を基準に評価（1000いいねで満点）
      const engagementScore = Math.min(100, (avgLikes / 1000) * 100);

      // 3. コスト効率スコア（重み: 20%）
      //    - いいね単価が低いほど高評価（50円以下で満点、200円以上で0点）
      const efficiencyScore = costPerLike > 0
        ? Math.max(0, Math.min(100, ((200 - costPerLike) / 150) * 100))
        : 50;

      // 4. 信頼性スコア（重み: 15%）- 納期遵守率のみ
      const reliabilityScore = onTimeRate;

      // 総合スコア
      const score = Math.round(
        considerationScore * 0.40 +
        engagementScore * 0.25 +
        efficiencyScore * 0.20 +
        reliabilityScore * 0.15
      );

      // ランク判定
      let rank = 'C';
      if (score >= 75) rank = 'S';
      else if (score >= 55) rank = 'A';
      else if (score >= 35) rank = 'B';

      setInfluencer({
        ...influencerData,
        campaigns,
        stats: {
          totalCampaigns,
          agreedCampaigns,
          totalLikes,
          totalComments,
          totalSpent,
          avgLikes,
          avgCost,
          costPerLike,
          agreementRate,
          onTimeRate,
          score,
          rank,
        },
      });

      // ローカルストレージからお気に入り/ブラックリスト状態を取得
      const favorites = JSON.parse(localStorage.getItem('favoriteInfluencers') || '[]');
      const blacklist = JSON.parse(localStorage.getItem('blacklistedInfluencers') || '[]');
      setIsFavorite(favorites.includes(influencerId));
      setIsBlacklisted(blacklist.includes(influencerId));
    } catch (err) {
      showToast('error', translateError(err));
      router.push('/influencers');
    } finally {
      setLoading(false);
    }
  }, [influencerId, showToast, router, currentBrand]);

  useEffect(() => {
    if (user && influencerId) {
      fetchInfluencer();
    }
  }, [user, influencerId, fetchInfluencer]);

  const toggleFavorite = () => {
    const favorites = JSON.parse(localStorage.getItem('favoriteInfluencers') || '[]');
    if (isFavorite) {
      const newFavorites = favorites.filter((id: string) => id !== influencerId);
      localStorage.setItem('favoriteInfluencers', JSON.stringify(newFavorites));
      setIsFavorite(false);
      showToast('info', 'お気に入りから削除しました');
    } else {
      favorites.push(influencerId);
      localStorage.setItem('favoriteInfluencers', JSON.stringify(favorites));
      setIsFavorite(true);
      showToast('success', 'お気に入りに追加しました');
    }
  };

  const toggleBlacklist = () => {
    const blacklist = JSON.parse(localStorage.getItem('blacklistedInfluencers') || '[]');
    if (isBlacklisted) {
      const newBlacklist = blacklist.filter((id: string) => id !== influencerId);
      localStorage.setItem('blacklistedInfluencers', JSON.stringify(newBlacklist));
      setIsBlacklisted(false);
      showToast('info', 'ブラックリストから削除しました');
    } else {
      blacklist.push(influencerId);
      localStorage.setItem('blacklistedInfluencers', JSON.stringify(blacklist));
      setIsBlacklisted(true);
      showToast('warning', 'ブラックリストに追加しました');
    }
  };

  const getRankColor = (rank: string) => {
    switch (rank) {
      case 'S': return 'text-amber-500';
      case 'A': return 'text-purple-500';
      case 'B': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getRankIcon = (rank: string) => {
    switch (rank) {
      case 'S': return <Crown className="text-amber-500" size={24} />;
      case 'A': return <Medal className="text-purple-500" size={24} />;
      case 'B': return <Award className="text-blue-500" size={24} />;
      default: return <Star className="text-gray-500" size={24} />;
    }
  };

  if (authLoading || loading) {
    return <LoadingSpinner fullScreen message="読み込み中..." />;
  }

  if (!influencer) {
    return (
      <MainLayout>
        <div className="text-center py-20">
          <p className="text-gray-500">インフルエンサーが見つかりません</p>
          <Link href="/influencers" className="btn-primary mt-4">
            一覧に戻る
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/influencers" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
            </Link>
            <div className="p-3 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl shadow-lg shadow-pink-500/30">
              <Instagram className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                @{influencer.insta_name || influencer.tiktok_name || '不明'}
                {isFavorite && <Star className="text-amber-500 fill-current" size={20} />}
                {isBlacklisted && <Ban className="text-red-500" size={20} />}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-0.5">インフルエンサー詳細・実績</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFavorite}
              className={`btn-secondary flex items-center gap-2 ${isFavorite ? 'bg-amber-100 dark:bg-amber-900/30' : ''}`}
            >
              {isFavorite ? <Star className="text-amber-500 fill-current" size={18} /> : <StarOff size={18} />}
              {isFavorite ? 'お気に入り' : 'お気に入りに追加'}
            </button>
            <button
              onClick={toggleBlacklist}
              className={`btn-secondary flex items-center gap-2 ${isBlacklisted ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
            >
              <Ban size={18} className={isBlacklisted ? 'text-red-500' : ''} />
              {isBlacklisted ? 'ブラックリスト中' : 'ブラックリスト'}
            </button>
          </div>
        </div>

        {/* スコアカード */}
        <div className="card bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-center">
                {getRankIcon(influencer.stats.rank)}
                <p className={`text-3xl font-bold ${getRankColor(influencer.stats.rank)}`}>
                  {influencer.stats.rank}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">ランク</p>
              </div>
              <div className="h-16 w-px bg-gray-300 dark:bg-gray-600" />
              <div className="text-center">
                <p className="text-4xl font-bold text-gray-900 dark:text-white">{influencer.stats.score}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">総合スコア</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Heart className="text-pink-500" size={16} />
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {Math.round(influencer.stats.avgLikes).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">平均いいね</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <DollarSign className="text-green-500" size={16} />
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    ¥{Math.round(influencer.stats.costPerLike).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">いいね単価</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle className="text-blue-500" size={16} />
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {influencer.stats.agreementRate.toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">合意率</p>
              </div>
            </div>
          </div>
        </div>

        {/* 統計グリッド */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Target className="text-blue-600 dark:text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">総案件数</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{influencer.stats.totalCampaigns}</p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                <Heart className="text-pink-600 dark:text-pink-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">総いいね数</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {influencer.stats.totalLikes.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <DollarSign className="text-green-600 dark:text-green-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">総支出額</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  ¥{influencer.stats.totalSpent.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Clock className="text-purple-600 dark:text-purple-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">納期遵守率</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {influencer.stats.onTimeRate.toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* キャンペーン履歴 */}
        <div className="card">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity size={20} className="text-gray-500" />
            キャンペーン履歴
          </h3>

          {influencer.campaigns.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              キャンペーン履歴はありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-400">ブランド</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-400">品番</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">金額</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-600 dark:text-gray-400">ステータス</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">いいね</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-400">日付</th>
                  </tr>
                </thead>
                <tbody>
                  {influencer.campaigns.slice(0, 10).map(c => (
                    <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-2 font-medium text-gray-900 dark:text-white">{c.brand || '-'}</td>
                      <td className="py-3 px-2 text-gray-600 dark:text-gray-400">{c.item_code || '-'}</td>
                      <td className="py-3 px-2 text-right text-gray-900 dark:text-white">
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
                      <td className="py-3 px-2 text-right text-gray-900 dark:text-white">
                        {(c.likes || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-gray-600 dark:text-gray-400">
                        {c.created_at ? format(new Date(c.created_at), 'yyyy/MM/dd', { locale: ja }) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {influencer.campaigns.length > 10 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  他 {influencer.campaigns.length - 10} 件のキャンペーン
                </p>
              )}
            </div>
          )}
        </div>

        {/* リンク */}
        <div className="card">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">外部リンク</h3>
          <div className="flex flex-wrap gap-3">
            {influencer.insta_url && (
              <a
                href={influencer.insta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center gap-2"
              >
                <Instagram size={18} />
                Instagram
                <ExternalLink size={14} />
              </a>
            )}
            {influencer.tiktok_url && (
              <a
                href={influencer.tiktok_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center gap-2"
              >
                TikTok
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
