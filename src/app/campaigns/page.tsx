'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Campaign, Influencer } from '@/types';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast, translateError } from '@/lib/toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import LoadingSpinner, { TableSkeleton } from '@/components/ui/LoadingSpinner';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import EmptyState from '@/components/ui/EmptyState';
import dynamic from 'next/dynamic';
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
  FileText,
} from 'lucide-react';
import { useBrand } from '@/contexts/BrandContext';
import { useCampaigns, useInfluencers, useDeleteCampaign } from '@/hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';

const CampaignModal = dynamic(() => import('@/components/forms/CampaignModal'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 text-foreground">
          <Loader2 className="animate-spin" size={18} />
          <span className="text-sm">フォームを読み込み中...</span>
        </div>
      </div>
    </div>
  ),
});

const ENGAGEMENT_UNAVAILABLE_TAG = '非公開または削除済み';

function extractTags(notes: string | null | undefined): string[] {
  const source = String(notes || '');
  const match = source.match(/\[TAGS:(.*?)\]/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function hasUnavailableEngagementTag(notes: string | null | undefined): boolean {
  return extractTags(notes).includes(ENGAGEMENT_UNAVAILABLE_TAG);
}

export default function CampaignsPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { currentBrand } = useBrand();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // React Query hooks
  const { data: campaignsData, isLoading: campaignsLoading, error: campaignsError, refetch } = useCampaigns();
  const { data: influencersData } = useInfluencers();
  const deleteCampaignMutation = useDeleteCampaign();

  const campaigns = campaignsData || [];
  const influencers = influencersData || [];
  const loading = campaignsLoading;
  const error = campaignsError ? translateError(campaignsError) : null;

  // Initialize filters from URL params
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get('status') || 'all');

  // Sync filter state to URL (debounced for search)
  const updateUrlParams = useCallback((q: string, status: string) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (status && status !== 'all') params.set('status', status);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router]);

  // Debounce search term URL update
  useEffect(() => {
    const timer = setTimeout(() => {
      updateUrlParams(searchTerm, statusFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, updateUrlParams]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const [opsFilters, setOpsFilters] = useState({
    missingItemCode: false,
    missingCost: false,
    missingPostUrl: false,
    missingEngagement: false,
  });

  // クイック編集（よく触る項目だけ）
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickEditDraft, setQuickEditDraft] = useState<{
    status: Campaign['status'];
    post_url: string;
    post_date: string;
    likes: string;
    comments: string;
    engagement_date: string;
  } | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);

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

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const openQuickEdit = (campaign: Campaign) => {
    setQuickEditId(campaign.id);
    setQuickEditDraft({
      status: campaign.status,
      post_url: campaign.post_url || '',
      post_date: campaign.post_date || '',
      likes: String(campaign.likes ?? ''),
      comments: String(campaign.comments ?? ''),
      engagement_date: campaign.engagement_date || '',
    });
  };

  const closeQuickEdit = () => {
    setQuickEditId(null);
    setQuickEditDraft(null);
    setQuickSaving(false);
  };

  const saveQuickEdit = async (campaign: Campaign) => {
    if (!quickEditDraft) return;
    if (quickSaving) return;

    setQuickSaving(true);
    try {
      const likes = parseInt(quickEditDraft.likes, 10);
      const comments = parseInt(quickEditDraft.comments, 10);
      const nextLikes = Number.isFinite(likes) ? likes : 0;
      const nextComments = Number.isFinite(comments) ? comments : 0;

      let nextStatus = quickEditDraft.status;
      if (nextLikes > 0 && nextStatus === 'pending') {
        nextStatus = 'agree';
      }

      const trimmedUrl = (quickEditDraft.post_url || '').trim();
      let nextPostDate = quickEditDraft.post_date || '';
      if (trimmedUrl && !nextPostDate) {
        nextPostDate = getTodayDate();
      }

      let nextEngagementDate = quickEditDraft.engagement_date || '';
      if ((nextLikes > 0 || nextComments > 0) && !nextEngagementDate) {
        nextEngagementDate = getTodayDate();
      }

      const updates = {
        status: nextStatus,
        post_url: trimmedUrl ? trimmedUrl : null,
        post_date: trimmedUrl ? (nextPostDate || null) : null,
        likes: nextLikes,
        comments: nextComments,
        engagement_date: (nextLikes > 0 || nextComments > 0) ? (nextEngagementDate || null) : null,
      } satisfies Partial<Campaign>;

      const noChanges =
        updates.status === campaign.status &&
        (updates.post_url || '') === (campaign.post_url || '') &&
        (updates.post_date || '') === (campaign.post_date || '') &&
        (updates.likes ?? 0) === (campaign.likes ?? 0) &&
        (updates.comments ?? 0) === (campaign.comments ?? 0) &&
        (updates.engagement_date || '') === (campaign.engagement_date || '');

      if (noChanges) {
        showToast('info', '変更がありません');
        closeQuickEdit();
        return;
      }

      const { error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', campaign.id)
        .eq('brand', currentBrand);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['campaigns', currentBrand] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats', currentBrand] });
      queryClient.invalidateQueries({ queryKey: ['dashboardFullStats', currentBrand] });

      showToast('success', '更新しました');
      closeQuickEdit();
    } catch (err) {
      showToast('error', translateError(err));
      setQuickSaving(false);
    }
  };

  const handleSave = async (savedCampaign?: Campaign | null) => {
    if (savedCampaign?.id) {
      queryClient.setQueryData(['campaigns', currentBrand], (previous: unknown) => {
        const list = Array.isArray(previous) ? (previous as Campaign[]) : [];
        const index = list.findIndex((row) => row.id === savedCampaign.id);
        if (index >= 0) {
          const next = [...list];
          next[index] = { ...next[index], ...savedCampaign };
          return next;
        }
        return [savedCampaign, ...list];
      });
    }

    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['campaigns', currentBrand] }),
        queryClient.invalidateQueries({ queryKey: ['dashboardStats', currentBrand] }),
        queryClient.invalidateQueries({ queryKey: ['dashboardFullStats', currentBrand] }),
      ]);
      await refetch();
    } catch {
      // Save itself is already completed. Keep UX moving even if background refresh fails.
    } finally {
      handleModalClose();
    }
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
      const updates: Record<string, unknown> = {};

      if (bulkEditData.status) {
        updates.status = bulkEditData.status;
      }
      if (bulkEditData.agreed_amount) {
        updates.agreed_amount = parseFloat(bulkEditData.agreed_amount);
      }

      if (Object.keys(updates).length === 0) {
        showToast('error', '更新内容を選択してください');
        return;
      }

      const { error } = await supabase
        .from('campaigns')
        .update(updates)
        .in('id', Array.from(selectedIds))
        .eq('brand', currentBrand);

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
      const response = await fetch('/api/campaigns', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), brand: currentBrand }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `削除に失敗しました (${response.status})`);
      }

      // React Queryのキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['campaigns', currentBrand] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats', currentBrand] });

      setSelectedIds(new Set());
      showToast('success', `${selectedIds.size}件の案件を削除しました`);
    } catch (err) {
      showToast('error', translateError(err));
    }
  };

  const baseFilteredCampaigns = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return campaigns.filter((c) => {
      const influencerName = c.influencer?.insta_name || c.influencer?.tiktok_name || '';
      const itemCode = c.item_code || '';
      const matchesSearch =
        !term ||
        influencerName.toLowerCase().includes(term) ||
        itemCode.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [campaigns, searchTerm, statusFilter]);

  const opsCounts = useMemo(() => {
    const list = baseFilteredCampaigns;
    const isBlank = (v: unknown) => !String(v || '').trim();
    const countMissingItemCode = list.filter((c) => isBlank(c.item_code)).length;
    const countMissingCost = list.filter((c) => Number(c.product_cost || 0) <= 0).length;
    const countMissingPostUrl = list.filter((c) => isBlank(c.post_url)).length;
    const countMissingEngagement = list.filter((c) => {
      const hasPost = !isBlank(c.post_url);
      const isEngagementUnavailable = hasUnavailableEngagementTag(c.notes);
      const likes = Number(c.likes || 0);
      const comments = Number(c.comments || 0);
      return hasPost && !isEngagementUnavailable && likes <= 0 && comments <= 0;
    }).length;
    return {
      missingItemCode: countMissingItemCode,
      missingCost: countMissingCost,
      missingPostUrl: countMissingPostUrl,
      missingEngagement: countMissingEngagement,
    };
  }, [baseFilteredCampaigns]);

  const filteredCampaigns = useMemo(() => {
    const isBlank = (v: unknown) => !String(v || '').trim();
    let list = baseFilteredCampaigns;

    if (opsFilters.missingItemCode) {
      list = list.filter((c) => isBlank(c.item_code));
    }
    if (opsFilters.missingCost) {
      list = list.filter((c) => Number(c.product_cost || 0) <= 0);
    }
    if (opsFilters.missingPostUrl) {
      list = list.filter((c) => isBlank(c.post_url));
    }
    if (opsFilters.missingEngagement) {
      list = list.filter((c) => {
        const hasPost = !isBlank(c.post_url);
        const isEngagementUnavailable = hasUnavailableEngagementTag(c.notes);
        const likes = Number(c.likes || 0);
        const comments = Number(c.comments || 0);
        return hasPost && !isEngagementUnavailable && likes <= 0 && comments <= 0;
      });
    }

    return list;
  }, [baseFilteredCampaigns, opsFilters]);

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

  const tableCols = currentBrand === 'BE' ? 14 : 13;

  // 統計計算
  const stats = {
    total: filteredCampaigns.length,
    agree: filteredCampaigns.filter(c => c.status === 'agree').length,
    pending: filteredCampaigns.filter(c => c.status === 'pending').length,
    totalSpent: filteredCampaigns.reduce((sum, c) => sum + (c.agreed_amount || 0), 0),
    totalLikes: filteredCampaigns.reduce((sum, c) => sum + (c.likes || 0), 0),
  };

  // BE専用: 国別海外発送統計（useMemoで最適化）
  const internationalStats = useMemo(() => {
    if (currentBrand !== 'BE') return null;

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
  }, [currentBrand, filteredCampaigns]);

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
              <h1 className="text-2xl font-bold text-foreground">ギフティング案件管理</h1>
              <p className="text-muted-foreground mt-0.5">案件数: {campaigns.length}件</p>
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
            <p className="text-xs text-muted-foreground">表示中</p>
            <p className="text-xl font-bold text-foreground">{stats.total}件</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">合意済み</p>
            <p className="text-xl font-bold text-gray-800">{stats.agree}件</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">保留中</p>
            <p className="text-xl font-bold text-muted-foreground">{stats.pending}件</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">総支出</p>
            <p className="text-lg font-bold text-foreground">{formatAmount(stats.totalSpent)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">総いいね</p>
            <p className="text-xl font-bold text-foreground">{stats.totalLikes.toLocaleString()}</p>
          </div>
        </div>

        {/* BE専用: 国別海外発送分析 */}
        {currentBrand === 'BE' && internationalStats && internationalStats.total > 0 && (
          <div className="card bg-muted border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-muted rounded-lg">
                <Globe className="text-muted-foreground" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <Plane size={16} />
                  海外発送分析（BE専用）
                </h3>
                <p className="text-sm text-muted-foreground">
                  海外発送案件: {internationalStats.total}件 / 総送料: ¥{internationalStats.totalShippingCost.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {internationalStats.byCountry.map(({ country, count, cost, likes }) => (
                <div
                  key={country}
                  className="bg-white rounded-lg p-3 border border-border hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={14} className="text-muted-foreground" />
                    <span className="font-medium text-foreground text-sm truncate">{country}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">案件数</span>
                      <span className="font-bold text-gray-800">{count}件</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">送料計</span>
                      <span className="font-medium text-foreground">¥{cost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">いいね</span>
                      <span className="font-medium text-muted-foreground">{likes.toLocaleString()}</span>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
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
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
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

        {/* オペレーション用クイックフィルタ */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: 'missingItemCode', label: '品番未入力', count: opsCounts.missingItemCode },
              { key: 'missingCost', label: '原価未登録', count: opsCounts.missingCost },
              { key: 'missingPostUrl', label: '投稿URL未', count: opsCounts.missingPostUrl },
              { key: 'missingEngagement', label: 'エンゲ未', count: opsCounts.missingEngagement },
            ] as const
          ).map(({ key, label, count }) => {
            const active = opsFilters[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setOpsFilters((prev) => ({ ...prev, [key]: !prev[key] }))
                }
                className={`px-3 py-2 rounded-full border text-sm flex items-center gap-2 transition-colors ${
                  active
                    ? 'bg-primary text-white border-gray-900'
                    : 'bg-white text-foreground border-border hover:bg-muted'
                }`}
              >
                <span>{label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  active ? 'bg-white/15 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}

          {Object.values(opsFilters).some(Boolean) ? (
            <button
              type="button"
              className="px-3 py-2 rounded-full border text-sm bg-white text-muted-foreground border-border hover:bg-muted transition-colors"
              onClick={() => setOpsFilters({
                missingItemCode: false,
                missingCost: false,
                missingPostUrl: false,
                missingEngagement: false,
              })}
            >
              クリア
            </button>
          ) : null}
        </div>

        {/* 一括操作バー */}
        {selectedIds.size > 0 && (
          <div className="bg-muted border border-border rounded-xl p-4 flex items-center justify-between animate-slide-up">
            <div className="flex items-center gap-3">
              <CheckSquare className="text-foreground" size={20} />
              <span className="font-medium text-foreground">
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
                className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                一括削除
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X size={18} className="text-muted-foreground" />
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
                  className="p-2 hover:bg-muted rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  {selectedIds.size}件の案件を一括で更新します。変更したい項目のみ入力してください。
                </p>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
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
                  <label className="block text-sm font-medium text-foreground mb-1">
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
            searchTerm || statusFilter !== 'all' ? (
              <EmptyState
                icon={<Search size={32} />}
                title="検索結果がありません"
                description="検索条件を変更してお試しください"
              />
            ) : (
              <EmptyState
                icon={<FileText size={32} />}
                title="案件が登録されていません"
                description="新規案件を作成して、ギフティング管理を始めましょう"
                action={{
                  label: '新規案件を作成',
                  onClick: () => setIsModalOpen(true),
                }}
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header px-4 py-3 w-10">
                      <button
                        onClick={toggleSelectAll}
                        className="p-1 hover:bg-muted rounded"
                      >
                        {selectedIds.size === filteredCampaigns.length ? (
                          <CheckSquare size={18} className="text-foreground" />
                        ) : (
                          <Square size={18} className="text-muted-foreground" />
                        )}
                      </button>
                    </th>
                    <th className="table-header px-4 py-3">ブランド</th>
                    <th className="table-header px-4 py-3">インフルエンサー</th>
                    <th className="table-header px-4 py-3">品番</th>
                    {currentBrand === 'BE' && (
                      <th className="table-header px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Plane size={14} className="text-muted-foreground" />
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
                    <Fragment key={campaign.id}>
                      <tr
                        className={`table-row ${selectedIds.has(campaign.id) ? 'bg-muted' : ''}`}
                      >
                        <td className="table-cell">
                          <button
                            onClick={() => toggleSelect(campaign.id)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {selectedIds.has(campaign.id) ? (
                              <CheckSquare size={18} className="text-foreground" />
                            ) : (
                              <Square size={18} className="text-muted-foreground" />
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
                                <MapPin size={12} className="text-muted-foreground" />
                                <span className="text-foreground text-xs font-medium">
                                  {campaign.shipping_country || '未設定'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">国内</span>
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
                        <td className="table-cell text-muted-foreground">
                          {formatDate(campaign.post_date)}
                        </td>
                        <td className="table-cell">
                          {hasUnavailableEngagementTag(campaign.notes) ? (
                            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
                              非公開または削除済み
                            </span>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1 text-foreground">
                                <Heart size={14} />
                                {campaign.likes?.toLocaleString() || 0}
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <MessageCircle size={14} />
                                {campaign.comments?.toLocaleString() || 0}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="table-cell">
                          {campaign.post_url ? (
                            <a
                              href={campaign.post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-white hover:underline flex items-center gap-1"
                            >
                              表示
                              <ExternalLink size={14} />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="table-cell">
                          {campaign.staff ? (
                            <span className="text-xs text-muted-foreground font-medium">
                              {campaign.staff.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">未設定</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <div className="text-xs text-muted-foreground">
                            {formatDate(campaign.updated_at || campaign.created_at)}
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                if (quickEditId === campaign.id) {
                                  closeQuickEdit();
                                } else {
                                  openQuickEdit(campaign);
                                }
                              }}
                              className={`p-2 rounded-lg transition-colors ${
                                quickEditId === campaign.id
                                  ? 'bg-muted text-foreground'
                                  : 'text-muted-foreground hover:bg-muted'
                              }`}
                              title="クイック編集"
                            >
                              <Settings2 size={16} />
                            </button>
                            <button
                              onClick={() => handleEdit(campaign)}
                              className="p-2 text-muted-foreground hover:bg-muted rounded-lg"
                              title="詳細編集"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(campaign.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="削除"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {quickEditId === campaign.id && quickEditDraft ? (
                        <tr className="bg-muted">
                          <td className="px-6 py-4" colSpan={tableCols}>
                            <div className="flex flex-col gap-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-medium text-foreground">クイック編集</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    ステータス / 投稿URL / いいね / コメント
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="text-xs text-muted-foreground hover:text-foreground"
                                  onClick={closeQuickEdit}
                                >
                                  閉じる
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">ステータス</label>
                                  <select
                                    value={quickEditDraft.status}
                                    onChange={(e) =>
                                      setQuickEditDraft((prev) => prev ? ({ ...prev, status: e.target.value as Campaign['status'] }) : prev)
                                    }
                                    className="input-field text-sm"
                                  >
                                    <option value="pending">保留</option>
                                    <option value="agree">合意</option>
                                    <option value="disagree">不合意</option>
                                    <option value="cancelled">キャンセル</option>
                                    <option value="ignored">無視</option>
                                  </select>
                                  <p className="text-[11px] text-muted-foreground mt-1">※いいね入力で保留→合意に自動更新</p>
                                </div>

                                <div className="md:col-span-2">
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">投稿URL</label>
                                  <input
                                    type="url"
                                    value={quickEditDraft.post_url}
                                    onChange={(e) =>
                                      setQuickEditDraft((prev) => prev ? ({ ...prev, post_url: e.target.value }) : prev)
                                    }
                                    className="input-field text-sm"
                                    placeholder="https://..."
                                  />
                                  <p className="text-[11px] text-muted-foreground mt-1">※URL入力時、投稿日が未設定なら当日を自動設定</p>
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">いいね</label>
                                  <input
                                    type="number"
                                    value={quickEditDraft.likes}
                                    onChange={(e) =>
                                      setQuickEditDraft((prev) => {
                                        if (!prev) return prev;
                                        const nextLikes = e.target.value;
                                        const num = parseInt(nextLikes, 10) || 0;
                                        const next: typeof prev = { ...prev, likes: nextLikes };
                                        if (num > 0 && prev.status === 'pending') next.status = 'agree';
                                        if (num > 0 && !prev.engagement_date) next.engagement_date = getTodayDate();
                                        return next;
                                      })
                                    }
                                    className="input-field text-sm"
                                    min={0}
                                  />
                                  <p className="text-[11px] text-muted-foreground mt-1">※入力日が未設定なら当日を自動設定</p>
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">コメント</label>
                                  <input
                                    type="number"
                                    value={quickEditDraft.comments}
                                    onChange={(e) =>
                                      setQuickEditDraft((prev) => {
                                        if (!prev) return prev;
                                        const nextComments = e.target.value;
                                        const num = parseInt(nextComments, 10) || 0;
                                        const next: typeof prev = { ...prev, comments: nextComments };
                                        if (num > 0 && !prev.engagement_date) next.engagement_date = getTodayDate();
                                        return next;
                                      })
                                    }
                                    className="input-field text-sm"
                                    min={0}
                                  />
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="text-xs text-muted-foreground">
                                    入力日: <span className="font-medium text-foreground">{quickEditDraft.engagement_date || '未設定'}</span>
                                  </div>
                                  {quickEditDraft.post_url ? (
                                    <div className="text-xs text-muted-foreground">
                                      投稿日: <span className="font-medium text-foreground">{quickEditDraft.post_date || '自動設定(当日)'}</span>
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={closeQuickEdit}
                                    disabled={quickSaving}
                                  >
                                    キャンセル
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-primary flex items-center gap-2"
                                    onClick={() => saveQuickEdit(campaign)}
                                    disabled={quickSaving}
                                  >
                                    {quickSaving ? <Loader2 size={18} className="animate-spin" /> : null}
                                    保存
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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
