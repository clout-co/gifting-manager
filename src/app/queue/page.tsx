'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ClipboardList, Hash, Link as LinkIcon, MessageCircle, Heart, AlertTriangle, Loader2 } from 'lucide-react';

import MainLayout from '@/components/layout/MainLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { useCampaigns, useInfluencers } from '@/hooks/useQueries';
import { translateError } from '@/lib/toast';
import type { Campaign, Influencer } from '@/types';

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

type QueueReason = 'missing_item_code' | 'missing_cost' | 'missing_post_url' | 'missing_engagement';

function isBlank(v: unknown): boolean {
  return !String(v || '').trim();
}

function formatDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('ja-JP');
}

function toQueueReasons(c: Campaign): QueueReason[] {
  const reasons: QueueReason[] = [];
  if (isBlank(c.item_code)) reasons.push('missing_item_code');
  if (Number(c.product_cost || 0) <= 0) reasons.push('missing_cost');
  if (isBlank(c.post_url)) reasons.push('missing_post_url');
  const hasPost = !isBlank(c.post_url);
  const likes = Number(c.likes || 0);
  const comments = Number(c.comments || 0);
  if (hasPost && likes <= 0 && comments <= 0) reasons.push('missing_engagement');
  return reasons;
}

function reasonLabel(r: QueueReason): string {
  switch (r) {
    case 'missing_item_code':
      return '品番未入力';
    case 'missing_cost':
      return '原価未登録';
    case 'missing_post_url':
      return '投稿URL未';
    case 'missing_engagement':
      return 'エンゲ未';
    default:
      return r;
  }
}

function reasonPriority(r: QueueReason): number {
  switch (r) {
    case 'missing_item_code':
      return 1;
    case 'missing_cost':
      return 2;
    case 'missing_post_url':
      return 3;
    case 'missing_engagement':
      return 4;
    default:
      return 99;
  }
}

export default function QueuePage() {
  const { loading: authLoading } = useAuth();
  const { currentBrand } = useBrand();

  const {
    data: campaignsData,
    isLoading: campaignsLoading,
    error: campaignsError,
    refetch,
  } = useCampaigns();
  const { data: influencersData } = useInfluencers();

  const campaigns = campaignsData || [];
  const influencers = (influencersData || []) as Influencer[];

  const [filters, setFilters] = useState<Record<QueueReason, boolean>>({
    missing_item_code: false,
    missing_cost: false,
    missing_post_url: false,
    missing_engagement: false,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const queueItems = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const toSortableSaleDate = (d: string | null) => (d ? d : `${today}T99:99:99`);

    const items = campaigns
      .map((c) => {
        const reasons = toQueueReasons(c);
        const priority = reasons.length > 0 ? Math.min(...reasons.map(reasonPriority)) : 99;
        return { campaign: c, reasons, priority };
      })
      .filter((it) => it.reasons.length > 0)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const as = String(toSortableSaleDate(a.campaign.sale_date));
        const bs = String(toSortableSaleDate(b.campaign.sale_date));
        if (as !== bs) return as.localeCompare(bs);
        return String(b.campaign.created_at || '').localeCompare(String(a.campaign.created_at || ''));
      });

    const enabled = (Object.entries(filters) as Array<[QueueReason, boolean]>).filter(([, v]) => v);
    if (enabled.length === 0) return items;

    const enabledKeys = new Set(enabled.map(([k]) => k));
    return items.filter((it) => it.reasons.some((r) => enabledKeys.has(r)));
  }, [campaigns, filters]);

  const counts = useMemo(() => {
    const base = campaigns.map((c) => toQueueReasons(c));
    const all = base.filter((r) => r.length > 0);
    const count = (key: QueueReason) => all.filter((r) => r.includes(key)).length;
    return {
      total: all.length,
      missing_item_code: count('missing_item_code'),
      missing_cost: count('missing_cost'),
      missing_post_url: count('missing_post_url'),
      missing_engagement: count('missing_engagement'),
    };
  }, [campaigns]);

  const openEdit = (c: Campaign) => {
    setEditingCampaign(c);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCampaign(null);
  };

  if (authLoading || campaignsLoading) {
    return <LoadingSpinner fullScreen message="読み込み中..." />;
  }

  const error = campaignsError ? translateError(campaignsError) : null;
  if (error) {
    return (
      <MainLayout>
        <ErrorDisplay message={error} onRetry={() => refetch()} showHomeLink />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg shadow-gray-900/20">
              <ClipboardList className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">要入力キュー</h1>
              <p className="text-muted-foreground mt-0.5">
                未入力・未整備の案件だけを抽出して処理（ブランド: {currentBrand} / {counts.total}件）
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">対象</p>
            <p className="text-xl font-bold text-foreground">{counts.total}件</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Hash size={14} />品番未</p>
            <p className="text-xl font-bold text-foreground">{counts.missing_item_code}件</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle size={14} />原価未</p>
            <p className="text-xl font-bold text-foreground">{counts.missing_cost}件</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><LinkIcon size={14} />URL未</p>
            <p className="text-xl font-bold text-foreground">{counts.missing_post_url}件</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Heart size={14} />エンゲ未</p>
            <p className="text-xl font-bold text-foreground">{counts.missing_engagement}件</p>
          </div>
        </div>

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="text-sm font-medium text-foreground">フィルタ</div>
            <div className="flex flex-wrap gap-2">
              {(
                Object.keys(filters) as QueueReason[]
              ).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    filters[key]
                      ? 'bg-primary text-white border-gray-900'
                      : 'bg-white text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {reasonLabel(key)}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    missing_item_code: false,
                    missing_cost: false,
                    missing_post_url: false,
                    missing_engagement: false,
                  })
                }
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-white text-foreground hover:bg-muted"
              >
                クリア
              </button>
            </div>
          </div>

          {queueItems.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={28} />}
              title="要入力の案件がありません"
              description="このブランドで未入力・未整備の案件は見つかりませんでした"
              action={{
                label: '再読み込み',
                onClick: () => refetch(),
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">インフルエンサー</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">セール日</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">品番/原価</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">投稿</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">エンゲ</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {queueItems.map(({ campaign, reasons }) => {
                    const handle = campaign.influencer?.insta_name || campaign.influencer?.tiktok_name || '不明';
                    const likes = Number(campaign.likes || 0);
                    const comments = Number(campaign.comments || 0);

                    return (
                      <tr key={campaign.id} className="hover:bg-muted">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground truncate">@{handle}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {reasons.map((r) => (
                              <span
                                key={r}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-foreground border border-border"
                              >
                                {reasonLabel(r)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground tabular-nums">
                          {formatDate(campaign.sale_date)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full border ${
                              isBlank(campaign.item_code)
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-border bg-muted text-foreground'
                            }`}>
                              {isBlank(campaign.item_code) ? '未入力' : String(campaign.item_code)}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full border ${
                              Number(campaign.product_cost || 0) <= 0
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            }`}>
                              {Number(campaign.product_cost || 0) <= 0 ? '原価未' : `原価 ${Number(campaign.product_cost || 0).toLocaleString()}円`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <LinkIcon size={16} className="text-muted-foreground" />
                            <span className={`text-xs ${
                              isBlank(campaign.post_url) ? 'text-red-700' : 'text-foreground'
                            }`}>
                              {isBlank(campaign.post_url) ? '未入力' : '入力済み'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-foreground">
                              <Heart size={16} className="text-muted-foreground" />
                              <span className="tabular-nums">{likes}</span>
                            </div>
                            <div className="flex items-center gap-1 text-foreground">
                              <MessageCircle size={16} className="text-muted-foreground" />
                              <span className="tabular-nums">{comments}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEdit(campaign)}
                            className="btn-secondary btn-sm"
                          >
                            編集
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isModalOpen && (
          <CampaignModal
            campaign={editingCampaign}
            influencers={influencers}
            onClose={closeModal}
            onSave={() => {
              closeModal();
              refetch();
            }}
          />
        )}
      </div>
    </MainLayout>
  );
}
