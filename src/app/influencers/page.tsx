'use client';

import { useState } from 'react';
import { Influencer, InfluencerWithScore } from '@/types';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast, translateError } from '@/lib/toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import LoadingSpinner, { CardSkeleton } from '@/components/ui/LoadingSpinner';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import EmptyState from '@/components/ui/EmptyState';
import { useBrand } from '@/contexts/BrandContext';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Instagram,
  ExternalLink,
  Users,
  SortAsc,
  SortDesc,
  List,
  LayoutGrid,
} from 'lucide-react';
import InfluencerModal from '@/components/forms/InfluencerModal';
import { useInfluencersWithScores } from '@/hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';

export default function InfluencersPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { currentBrand } = useBrand();
  const queryClient = useQueryClient();

  const { data: influencersData, isLoading: loading, error: queryError, refetch } = useInfluencersWithScores();
  const influencers = (influencersData || []) as InfluencerWithScore[];
  const error = queryError ? translateError(queryError) : null;

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInfluencer, setEditingInfluencer] = useState<Influencer | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [sortBy, setSortBy] = useState<'score' | 'likes' | 'cost' | 'campaigns'>('campaigns');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
      const response = await fetch(`/api/influencers/${id}`, {
        method: 'DELETE',
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const msg = data && typeof data.error === 'string'
          ? data.error
          : `削除に失敗しました (${response.status})`;
        throw new Error(msg);
      }

      queryClient.invalidateQueries({ queryKey: ['influencersWithScores', currentBrand] });
      queryClient.invalidateQueries({ queryKey: ['influencers', currentBrand] });
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
    queryClient.invalidateQueries({ queryKey: ['influencersWithScores', currentBrand] });
    queryClient.invalidateQueries({ queryKey: ['influencers', currentBrand] });
    handleModalClose();
    showToast('success', editingInfluencer ? '更新しました' : '追加しました');
  };

  const filteredAndSorted = influencers
    .filter((i) => {
      const name = i.insta_name || i.tiktok_name || '';
      return name.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'score': comparison = a.score - b.score; break;
        case 'likes': comparison = a.totalLikes - b.totalLikes; break;
        case 'cost': comparison = a.costPerLike - b.costPerLike; break;
        case 'campaigns': comparison = a.totalCampaigns - b.totalCampaigns; break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const fmt = (v: number) => new Intl.NumberFormat('ja-JP').format(v);
  const fmtYen = (v: number) =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(v);

  if (authLoading) return <LoadingSpinner fullScreen message="認証中..." />;

  if (error && !loading) {
    return (
      <MainLayout>
        <ErrorDisplay message={error} onRetry={() => refetch()} showHomeLink />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/5 dark:bg-foreground/10">
              <Users size={18} className="text-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">インフルエンサー</h1>
              <p className="text-xs text-muted-foreground">{influencers.length}名</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus size={16} />
            新規追加
          </button>
        </section>

        {/* Search & Sort */}
        <section className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="名前で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field h-9 pl-8 pr-3 text-xs rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="input-field h-9 py-0 text-xs rounded-lg min-w-[110px]"
            >
              <option value="campaigns">案件数順</option>
              <option value="likes">いいね数順</option>
              <option value="cost">コスパ順</option>
              <option value="score">スコア順</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
              title={sortOrder === 'desc' ? '降順' : '昇順'}
            >
              {sortOrder === 'desc' ? <SortDesc size={14} /> : <SortAsc size={14} />}
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
              title={viewMode === 'cards' ? 'テーブル表示' : 'カード表示'}
            >
              {viewMode === 'cards' ? <List size={14} /> : <LayoutGrid size={14} />}
            </button>
          </div>
        </section>

        {/* Content */}
        {loading ? (
          <CardSkeleton count={6} />
        ) : filteredAndSorted.length === 0 ? (
          searchTerm ? (
            <EmptyState
              icon={<Search size={32} />}
              title="検索結果がありません"
              description="検索条件を変更してお試しください"
            />
          ) : (
            <EmptyState
              icon={<Users size={32} />}
              title="インフルエンサーが登録されていません"
              description="新規追加から始めましょう"
              action={{ label: '新規追加', onClick: () => setIsModalOpen(true) }}
            />
          )
        ) : viewMode === 'table' ? (
          /* Table view — default, most practical */
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="table-header px-4 py-2.5 text-xs text-left">名前</th>
                    <th className="table-header px-4 py-2.5 text-xs text-right">案件数</th>
                    <th className="table-header px-4 py-2.5 text-xs text-right">いいね</th>
                    <th className="table-header px-4 py-2.5 text-xs text-right">支出</th>
                    <th className="table-header px-4 py-2.5 text-xs text-right">いいね単価</th>
                    <th className="table-header px-4 py-2.5 text-xs text-center w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.map((inf) => (
                    <tr key={inf.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Instagram size={14} className="shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">@{inf.insta_name || inf.tiktok_name}</span>
                          {inf.insta_url && (
                            <a href={inf.insta_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-right text-foreground">{inf.totalCampaigns}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-foreground">{fmt(inf.totalLikes)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-foreground">{fmtYen(inf.totalSpent)}</td>
                      <td className="px-4 py-2.5 text-sm text-right">
                        <span className={inf.costPerLike > 0 && inf.costPerLike < 50
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-foreground'
                        }>
                          {inf.costPerLike > 0 ? fmtYen(inf.costPerLike) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(inf)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                            title="編集"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(inf.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                            title="削除"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Card view */
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredAndSorted.map((inf) => (
              <article
                key={inf.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                {/* Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <Instagram size={14} className="shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-semibold text-foreground">@{inf.insta_name || inf.tiktok_name}</span>
                </div>

                {/* Stats */}
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-muted/60 px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">案件</p>
                    <p className="text-sm font-bold text-foreground">{inf.totalCampaigns}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">いいね</p>
                    <p className="text-sm font-bold text-foreground">{fmt(inf.totalLikes)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">支出</p>
                    <p className="text-sm font-bold text-foreground">{fmtYen(inf.totalSpent)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">単価</p>
                    <p className={`text-sm font-bold ${inf.costPerLike > 0 && inf.costPerLike < 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                      {inf.costPerLike > 0 ? fmtYen(inf.costPerLike) : '-'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-1.5">
                  {inf.insta_url && (
                    <a
                      href={inf.insta_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <ExternalLink size={12} />
                      Instagram
                    </a>
                  )}
                  <div className="flex-1" />
                  <button onClick={() => handleEdit(inf)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="編集">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(inf.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="削除">
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

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
