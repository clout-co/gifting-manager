'use client';

import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Campaign, Influencer } from '@/types';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast, translateError } from '@/lib/toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import LoadingSpinner, { TableSkeleton } from '@/components/ui/LoadingSpinner';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  Filter,
  Heart,
  MessageCircle,
  CheckSquare,
  Square,
  X,
  Settings2,
  Loader2,
  Globe,
  Plane,
  MapPin,
} from 'lucide-react';
import CampaignModal from '@/components/forms/CampaignModal';
import { useBrand } from '@/contexts/BrandContext';
import { useCampaigns, useInfluencers, useDeleteCampaign } from '@/hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';

export default function CampaignsPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { currentBrand } = useBrand();
  const queryClient = useQueryClient();

  // React Query hooks
  const { data: campaignsData, isLoading: campaignsLoading, error: campaignsError, refetch } = useCampaigns();
  const { data: influencersData } = useInfluencers();
  const deleteCampaignMutation = useDeleteCampaign();

  const campaigns = campaignsData || [];
  const influencers = influencersData || [];
  const loading = campaignsLoading;
  const error = campaignsError ? translateError(campaignsError) : null;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // 一括編集用の状態
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    status: '',
    agreed_amount: '',
  });
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: '案件の削除',
      message: 'この案件を削除しますか？この操作は取り消せません。',
      type: 'danger',
      confirmText: '削除',
      cancelText: 'キャンセル',
    });

    if (!confirmed) return;

    try {
      await deleteCampaignMutation.mutateAsync(id);
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      showToast('success', '案件を削除しました');
    } catch (err) {
      showToast('error', translateError(err));
    }
  };

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingCampaign(null);
  };

  const handleSave = () => {
    // React Queryのキャッシュを無効化して自動的に再取得
    queryClient.invalidateQueries({ queryKey: ['campaigns', currentBrand] });
    queryClient.invalidateQueries({ queryKey: ['dashboardStats', currentBrand] });
    handleModalClose();
    showToast('success', editingCampaign ? '案件を更新しました' : '案件を作成しました');
  };

  // 選択系の処理
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCampaigns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCampaigns.map(c => c.id)));
    }
  };

  // 一括編集の実行
  const handleBulkEdit = async () => {
    if (selectedIds.size === 0) return;

    setBulkUpdating(true);

    try {
      const updates: Record<string, unknown> = {
        updated_by: user?.id,
      };

      if (bulkEditData.status) {
        updates.status = bulkEditData.status;
      }
      if (bulkEditData.agreed_amount) {
        updates.agreed_amount = parseFloat(bulkEditData.agreed_amount);
      }

      const { error } = await supabase
        .from('campaigns')
        .update(updates)
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      // React Queryのキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['campaigns', currentBrand] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats', currentBrand] });

      setSelectedIds(new Set());
      setIsBulkEditOpen(false);
      setBulkEditData({ status: '', agreed_amount: '' });
      showToast('success', `${selectedIds.size}件の案件を更新しました`);
    } catch (err) {
      showToast('error', translateError(err));
    } finally {
      setBulkUpdating(false);
    }
  };

  // 一括削除
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = await confirm({
      title: '一括削除',
      message: `選択した${selectedIds.size}件の案件を削除しますか？この操作は取り消せません。`,
      type: 'danger',
      confirmText: `${selectedIds.size}件を削除`,
      cancelText: 'キャンセル',
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      // React Queryのキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['campaigns', currentBrand] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats', currentBrand] });

      setSelectedIds(new Set());
      showToast('success', `${selectedIds.size}件の案件を削除しました`);
    } catch (err) {
      showToast('error', translateError(err));
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const influencerName = c.influencer?.insta_name || c.influencer?.tiktok_name || '';
    const matchesSearch =
      influencerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.item_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'agree':
        return 'status-agree';
      case 'disagree':
        return 'status-disagree';
      case 'pending':
        return 'status-pending';
      case 'cancelled':
        return 'status-cancelled';
      case 'ignored':
        return 'status-ignored';
      default:
        return 'status-pending';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'agree':
        return '合意';
      case 'disagree':
        return '不合意';
      case 'pending':
        return '保留';
      case 'cancelled':
        return 'キャンセル';
      case 'ignored':
        return '無視';
      default:
        return status;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ja-JP');
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  // 統計計算
  const stats = {
    total: filteredCampaigns.length,
    agree: filteredCampaigns.filter(c => c.status === 'agree').length,
    pending: filteredCampaigns.filter(c => c.status === 'pending').length,
    totalSpent: filteredCampaigns.reduce((sum, c) => sum + (c.agreed_amount || 0), 0),
    totalLikes: filteredCampaigns.reduce((sum, c) => sum + (c.likes || 0), 0),
  };

  // BE専用: 国別海外発送統計
  const internationalStats = currentBrand === 'BE' ? (() => {
    const internationalCampaigns = filteredCampaigns.filter(c => c.is_international_shipping);
    const countryMap = new Map<string, { count: number; cost: number; likes: number }>();

    internationalCampaigns.forEach(c => {
      const country = c.shipping_country || '未設定';
      const current = countryMap.get(country) || { count: 0, cost: 0, likes: 0 };
      countryMap.set(country, {
        count: current.count + 1,
        cost: current.cost + (c.international_shipping_cost || 0),
        likes: current.likes + (c.likes || 0),
      });
    });

    return {
      total: internationalCampaigns.length,
      totalShippingCost: internationalCampaigns.reduce((sum, c) => sum + (c.international_shipping_cost || 0), 0),
      byCountry: Array.from(countryMap.entries())
        .map(([country, data]) => ({ country, ...data }))
        .sort((a, b) => b.count - a.count),
    };
  })() : null;

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

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ギフティング案件管理</h1>
              <p className="text-gray-500 mt-0.5">案件数: {campaigns.length}件</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            新規案件
          </button>
        </div>

        {/* 統計サマリー */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="stat-card">
            <p className="text-xs text-gray-500">表示中</p>
            <p className="text-xl font-bold text-gray-900">{stats.total}件</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">合意済み</p>
            <p className="text-xl font-bold text-gray-800">{stats.agree}件</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">保留中</p>
            <p className="text-xl font-bold text-gray-500">{stats.pending}件</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">総支出</p>
            <p className="text-lg font-bold text-gray-900">{formatAmount(stats.totalSpent)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">総いいね</p>
            <p className="text-xl font-bold text-gray-700">{stats.totalLikes.toLocaleString()}</p>
          </div>
        </div>

        {/* BE専用: 国別海外発送分析 */}
        {currentBrand === 'BE' && internationalStats && internationalStats.total > 0 && (
          <div className="card bg-gray-50 border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gray-200 rounded-lg">
                <Globe className="text-gray-600" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Plane size={16} />
                  海外発送分析（BE専用）
                </h3>
                <p className="text-sm text-gray-600">
                  海外発送案件: {internationalStats.total}件 / 総送料: ¥{internationalStats.totalShippingCost.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {internationalStats.byCountry.map(({ country, count, cost, likes }) => (
                <div
                  key={country}
                  className="bg-white rounded-lg p-3 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={14} className="text-gray-500" />
                    <span className="font-medium text-gray-900 text-sm truncate">{country}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">案件数</span>
                      <span className="font-bold text-gray-800">{count}件</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">送料計</span>
                      <span className="font-medium text-gray-700">¥{cost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">いいね</span>
                      <span className="font-medium text-gray-600">{likes.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* フィルター */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="検索（インフルエンサー、品番、ブランド）..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field pl-9 pr-8 appearance-none cursor-pointer"
              >
                <option value="all">全ステータス</option>
                <option value="pending">保留</option>
                <option value="agree">合意</option>
                <option value="disagree">不合意</option>
                <option value="cancelled">キャンセル</option>
              </select>
            </div>
          </div>
        </div>

        {/* 一括操作バー */}
        {selectedIds.size > 0 && (
          <div className="bg-gray-100 border border-gray-300 rounded-xl p-4 flex items-center justify-between animate-slide-up">
            <div className="flex items-center gap-3">
              <CheckSquare className="text-gray-700" size={20} />
              <span className="font-medium text-gray-900">
                {selectedIds.size}件選択中
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBulkEditOpen(true)}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Settings2 size={16} />
                一括編集
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                一括削除
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>
          </div>
        )}

        {/* 一括編集モーダル */}
        {isBulkEditOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-scale-in">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold">一括編集</h2>
                <button
                  onClick={() => setIsBulkEditOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  {selectedIds.size}件の案件を一括で更新します。変更したい項目のみ入力してください。
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ステータス
                  </label>
                  <select
                    value={bulkEditData.status}
                    onChange={(e) => setBulkEditData({ ...bulkEditData, status: e.target.value })}
                    className="input-field"
                  >
                    <option value="">変更しない</option>
                    <option value="pending">保留</option>
                    <option value="agree">合意</option>
                    <option value="disagree">不合意</option>
                    <option value="cancelled">キャンセル</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    合意額
                  </label>
                  <input
                    type="number"
                    value={bulkEditData.agreed_amount}
                    onChange={(e) => setBulkEditData({ ...bulkEditData, agreed_amount: e.target.value })}
                    placeholder="変更しない場合は空欄"
                    className="input-field"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setIsBulkEditOpen(false)}
                    className="btn-secondary flex-1"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleBulkEdit}
                    disabled={bulkUpdating || (!bulkEditData.status && !bulkEditData.agreed_amount)}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {bulkUpdating && <Loader2 className="animate-spin" size={18} />}
                    更新する
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* テーブル */}
        <div className="card overflow-hidden">
          {loading ? (
            <TableSkeleton rows={8} cols={10} />
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchTerm || statusFilter !== 'all'
                ? '検索結果がありません'
                : '案件が登録されていません'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header px-4 py-3 w-10">
                      <button
                        onClick={toggleSelectAll}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        {selectedIds.size === filteredCampaigns.length ? (
                          <CheckSquare size={18} className="text-gray-700" />
                        ) : (
                          <Square size={18} className="text-gray-400" />
                        )}
                      </button>
                    </th>
                    <th className="table-header px-4 py-3">ブランド</th>
                    <th className="table-header px-4 py-3">インフルエンサー</th>
                    <th className="table-header px-4 py-3">品番</th>
                    {currentBrand === 'BE' && (
                      <th className="table-header px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Plane size={14} className="text-gray-500" />
                          発送先
                        </div>
                      </th>
                    )}
                    <th className="table-header px-4 py-3">提示額</th>
                    <th className="table-header px-4 py-3">合意額</th>
                    <th className="table-header px-4 py-3">ステータス</th>
                    <th className="table-header px-4 py-3">投稿日</th>
                    <th className="table-header px-4 py-3">エンゲージメント</th>
                    <th className="table-header px-4 py-3">投稿</th>
                    <th className="table-header px-4 py-3">担当者</th>
                    <th className="table-header px-4 py-3">更新日</th>
                    <th className="table-header px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCampaigns.map((campaign) => (
                    <tr
                      key={campaign.id}
                      className={`table-row ${selectedIds.has(campaign.id) ? 'bg-gray-100' : ''}`}
                    >
                      <td className="table-cell">
                        <button
                          onClick={() => toggleSelect(campaign.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {selectedIds.has(campaign.id) ? (
                            <CheckSquare size={18} className="text-gray-700" />
                          ) : (
                            <Square size={18} className="text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="table-cell">{campaign.brand || '-'}</td>
                      <td className="table-cell font-medium">
                        @{campaign.influencer?.insta_name || campaign.influencer?.tiktok_name || '不明'}
                      </td>
                      <td className="table-cell">{campaign.item_code || '-'}</td>
                      {currentBrand === 'BE' && (
                        <td className="table-cell">
                          {campaign.is_international_shipping ? (
                            <div className="flex items-center gap-1">
                              <MapPin size={12} className="text-gray-500" />
                              <span className="text-gray-700 text-xs font-medium">
                                {campaign.shipping_country || '未設定'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">国内</span>
                          )}
                        </td>
                      )}
                      <td className="table-cell">
                        {formatAmount(campaign.offered_amount)}
                      </td>
                      <td className="table-cell font-medium">
                        {formatAmount(campaign.agreed_amount)}
                      </td>
                      <td className="table-cell">
                        <span className={getStatusClass(campaign.status)}>
                          {getStatusLabel(campaign.status)}
                        </span>
                      </td>
                      <td className="table-cell text-gray-500">
                        {formatDate(campaign.post_date)}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-gray-700">
                            <Heart size={14} />
                            {campaign.likes?.toLocaleString() || 0}
                          </span>
                          <span className="flex items-center gap-1 text-gray-500">
                            <MessageCircle size={14} />
                            {campaign.comments?.toLocaleString() || 0}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        {campaign.post_url ? (
                          <a
                            href={campaign.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-300 hover:text-white hover:underline flex items-center gap-1"
                          >
                            表示
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="table-cell">
                        {campaign.staff ? (
                          <span className="text-xs text-gray-300 font-medium">
                            {campaign.staff.name}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">未設定</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="text-xs text-gray-500">
                          {formatDate(campaign.updated_at || campaign.created_at)}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(campaign)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(campaign.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
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
          )}
        </div>
      </div>

      {/* モーダル */}
      {isModalOpen && (
        <CampaignModal
          campaign={editingCampaign}
          influencers={influencers}
          onClose={handleModalClose}
          onSave={handleSave}
        />
      )}
    </MainLayout>
  );
}
