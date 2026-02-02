'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Gift,
  Settings2,
  Loader2,
} from 'lucide-react';
import CampaignModal from '@/components/forms/CampaignModal';

export default function CampaignsPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [influencersRes, campaignsRes] = await Promise.all([
        supabase.from('influencers').select('*'),
        supabase
          .from('campaigns')
          .select(`
            *,
            influencer:influencers(*)
          `)
          .order('created_at', { ascending: false }),
      ]);

      if (influencersRes.error) throw influencersRes.error;
      if (campaignsRes.error) throw campaignsRes.error;

      setInfluencers(influencersRes.data || []);
      setCampaigns(campaignsRes.data || []);
    } catch (err) {
      const errorMessage = translateError(err);
      setError(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

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
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;

      setCampaigns(campaigns.filter((c) => c.id !== id));
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
    fetchData();
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

      await fetchData();
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

      setCampaigns(campaigns.filter(c => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
      showToast('success', `${selectedIds.size}件の案件を削除しました`);
    } catch (err) {
      showToast('error', translateError(err));
    }
  };

  const brands = Array.from(new Set(campaigns.map((c) => c.brand).filter(Boolean)));

  const filteredCampaigns = campaigns.filter((c) => {
    const influencerName = c.influencer?.insta_name || c.influencer?.tiktok_name || '';
    const matchesSearch =
      influencerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesBrand = brandFilter === 'all' || c.brand === brandFilter;
    return matchesSearch && matchesStatus && matchesBrand;
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

  if (authLoading) {
    return <LoadingSpinner fullScreen message="認証中..." />;
  }

  if (error && !loading) {
    return (
      <MainLayout>
        <ErrorDisplay
          message={error}
          onRetry={fetchData}
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
            <div className="p-3 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl shadow-lg shadow-pink-500/30">
              <Gift className="text-white" size={24} />
            </div>
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
            <p className="text-xl font-bold text-green-600">{stats.agree}件</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">保留中</p>
            <p className="text-xl font-bold text-amber-600">{stats.pending}件</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">総支出</p>
            <p className="text-lg font-bold text-gray-900">{formatAmount(stats.totalSpent)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">総いいね</p>
            <p className="text-xl font-bold text-pink-600">{stats.totalLikes.toLocaleString()}</p>
          </div>
        </div>

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

            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="input-field appearance-none cursor-pointer"
            >
              <option value="all">全ブランド</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 一括操作バー */}
        {selectedIds.size > 0 && (
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center justify-between animate-slide-up">
            <div className="flex items-center gap-3">
              <CheckSquare className="text-primary-600" size={20} />
              <span className="font-medium text-primary-900">
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
                className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                一括削除
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-2 hover:bg-primary-100 rounded-lg transition-colors"
              >
                <X size={18} className="text-primary-600" />
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
              {searchTerm || statusFilter !== 'all' || brandFilter !== 'all'
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
                          <CheckSquare size={18} className="text-primary-600" />
                        ) : (
                          <Square size={18} className="text-gray-400" />
                        )}
                      </button>
                    </th>
                    <th className="table-header px-4 py-3">ブランド</th>
                    <th className="table-header px-4 py-3">インフルエンサー</th>
                    <th className="table-header px-4 py-3">品番</th>
                    <th className="table-header px-4 py-3">提示額</th>
                    <th className="table-header px-4 py-3">合意額</th>
                    <th className="table-header px-4 py-3">ステータス</th>
                    <th className="table-header px-4 py-3">投稿日</th>
                    <th className="table-header px-4 py-3">エンゲージメント</th>
                    <th className="table-header px-4 py-3">投稿</th>
                    <th className="table-header px-4 py-3">更新日</th>
                    <th className="table-header px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCampaigns.map((campaign) => (
                    <tr
                      key={campaign.id}
                      className={`table-row ${selectedIds.has(campaign.id) ? 'bg-primary-50' : ''}`}
                    >
                      <td className="table-cell">
                        <button
                          onClick={() => toggleSelect(campaign.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {selectedIds.has(campaign.id) ? (
                            <CheckSquare size={18} className="text-primary-600" />
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
                          <span className="flex items-center gap-1 text-pink-500">
                            <Heart size={14} />
                            {campaign.likes?.toLocaleString() || 0}
                          </span>
                          <span className="flex items-center gap-1 text-blue-500">
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
                            className="text-primary-600 hover:underline flex items-center gap-1"
                          >
                            表示
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
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
