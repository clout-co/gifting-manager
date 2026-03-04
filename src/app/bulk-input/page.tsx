'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useCampaigns, useBulkUpdateCampaigns } from '@/hooks/useQueries';
import { useToast } from '@/lib/toast';
import {
  Save,
  Loader2,
  CheckCircle2,
  Search,
  Filter,
  Instagram,
  Music2,
  RotateCcw,
  ExternalLink,
  Heart,
  MessageCircle,
  FileText,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';

interface EditableRow {
  id: string;
  influencer_username: string;
  platform: string;
  product: string;
  post_url: string | null;
  current_likes: number;
  current_comments: number;
  current_consideration: number;
  new_likes: number | '';
  new_comments: number | '';
  new_consideration: number | '';
  hasChanges: boolean;
}

const platformIcon = (platform: string) => {
  switch (platform?.toLowerCase()) {
    case 'instagram':
      return <Instagram size={14} className="text-pink-500" />;
    case 'tiktok':
      return <Music2 size={14} className="text-cyan-500" />;
    default:
      return null;
  }
};

export default function BulkInputPage() {
  const { data: campaigns, isLoading, error, refetch } = useCampaigns();
  const bulkUpdate = useBulkUpdateCampaigns();
  const { showToast } = useToast();

  const [rows, setRows] = useState<EditableRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);

  type InfluencerInfo = {
    insta_name?: string | null;
    tiktok_name?: string | null;
    insta_url?: string | null;
    tiktok_url?: string | null;
  } | null;

  const buildRows = useCallback((data: typeof campaigns) => {
    if (!data) return [];
    return data
      .filter((c) => c.status === 'agree' || c.status === 'pending')
      .map((c): EditableRow => {
        const influencer = c.influencer as InfluencerInfo;
        return {
          id: c.id,
          influencer_username: influencer?.insta_name || influencer?.tiktok_name || '不明',
          platform: influencer?.insta_url ? 'instagram' : influencer?.tiktok_url ? 'tiktok' : '',
          product: c.item_code || '',
          post_url: c.post_url || null,
          current_likes: c.likes || 0,
          current_comments: c.comments || 0,
          current_consideration: Number(c.consideration_comment || 0),
          new_likes: '',
          new_comments: '',
          new_consideration: '',
          hasChanges: false,
        };
      });
  }, []);

  useEffect(() => {
    setRows(buildRows(campaigns));
  }, [campaigns, buildRows]);

  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      row.influencer_username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.product.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'with-data' && (row.current_likes > 0 || row.current_comments > 0)) ||
      (statusFilter === 'no-data' && row.current_likes === 0 && row.current_comments === 0);
    return matchesSearch && matchesStatus;
  });

  const handleValueChange = (id: string, field: 'new_likes' | 'new_comments' | 'new_consideration', value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const numValue = value === '' ? '' : parseInt(value, 10) || 0;
        const updated = { ...row, [field]: numValue };
        updated.hasChanges =
          (updated.new_likes !== '' && updated.new_likes !== updated.current_likes) ||
          (updated.new_comments !== '' && updated.new_comments !== updated.current_comments) ||
          (updated.new_consideration !== '' && updated.new_consideration !== updated.current_consideration);
        return updated;
      })
    );
  };

  const handleSave = async () => {
    const changedRows = rows.filter((row) => row.hasChanges);
    if (changedRows.length === 0) {
      showToast('error', '変更がありません');
      return;
    }

    setIsSaving(true);
    try {
      const updates = changedRows.map((row) => ({
        id: row.id,
        likes: row.new_likes !== '' ? row.new_likes : undefined,
        comments: row.new_comments !== '' ? row.new_comments : undefined,
        consideration_comment: row.new_consideration !== '' ? row.new_consideration : undefined,
        input_date: new Date().toISOString().split('T')[0],
        status: 'agree' as const,
      }));

      await bulkUpdate.mutateAsync(updates.filter((u) => u.likes !== undefined || u.comments !== undefined || u.consideration_comment !== undefined));
      showToast('success', `${changedRows.length}件のデータを更新しました`);
      refetch();
    } catch {
      showToast('error', '更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setRows(buildRows(campaigns));
  };

  const changedCount = rows.filter((r) => r.hasChanges).length;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <AlertCircle className="text-red-500" size={32} />
          <p className="text-foreground">データの読み込みに失敗しました</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* ヘッダー */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">一括エンゲージメント入力</h1>
            <p className="text-muted-foreground text-sm mt-1">
              いいね数・コメント数・検討コメント数を一括で入力・更新できます
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm"
            >
              <RotateCcw size={14} />
              リセット
            </button>
            <button
              onClick={handleSave}
              disabled={changedCount === 0 || isSaving}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                changedCount > 0
                  ? 'bg-foreground text-background hover:bg-foreground/90 shadow-sm'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {changedCount > 0 ? `${changedCount}件を保存` : '保存'}
            </button>
          </div>
        </div>

        {/* フィルター + サマリー */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="インフルエンサー名・品番で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
            >
              <option value="all">すべて</option>
              <option value="no-data">未入力のみ</option>
              <option value="with-data">入力済みのみ</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* サマリーバー */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground px-1">
          <span>{filteredRows.length}件表示</span>
          <span className="text-border">|</span>
          <span>未入力: {filteredRows.filter(r => r.current_likes === 0 && r.current_comments === 0).length}件</span>
          {changedCount > 0 && (
            <>
              <span className="text-border">|</span>
              <span className="text-emerald-600 font-medium">{changedCount}件変更あり</span>
            </>
          )}
        </div>

        {/* テーブル */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[200px]">
                    インフルエンサー
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[100px]">
                    品番
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1">
                      <Heart size={11} />
                      いいね
                    </div>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-foreground uppercase tracking-wider bg-amber-50/80">
                    <div className="flex items-center justify-center gap-1">
                      <Heart size={11} className="text-amber-600" />
                      新しいいいね
                    </div>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1">
                      <MessageCircle size={11} />
                      コメント
                    </div>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-foreground uppercase tracking-wider bg-amber-50/80">
                    <div className="flex items-center justify-center gap-1">
                      <MessageCircle size={11} className="text-amber-600" />
                      新コメント
                    </div>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1">
                      <FileText size={11} />
                      検討
                    </div>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-foreground uppercase tracking-wider bg-amber-50/80">
                    <div className="flex items-center justify-center gap-1">
                      <FileText size={11} className="text-amber-600" />
                      新検討
                    </div>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[50px]">
                    投稿
                  </th>
                  <th className="px-2 py-3 text-center w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                      対象の案件がありません
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        row.hasChanges
                          ? 'bg-emerald-50 border-l-2 border-l-emerald-500'
                          : 'hover:bg-muted/30'
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {platformIcon(row.platform)}
                          <span className="text-foreground text-sm font-medium truncate max-w-[160px]">
                            {row.influencer_username}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-sm">
                        {row.product || '-'}
                      </td>
                      {/* 現在のいいね */}
                      <td className="px-3 py-2.5 text-center text-muted-foreground text-sm tabular-nums">
                        {row.current_likes.toLocaleString()}
                      </td>
                      {/* 新しいいいね入力 */}
                      <td className="px-2 py-1.5 bg-amber-50/40">
                        <input
                          type="number"
                          min="0"
                          value={row.new_likes}
                          onChange={(e) => handleValueChange(row.id, 'new_likes', e.target.value)}
                          placeholder={row.current_likes.toString()}
                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-foreground text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 placeholder:text-muted-foreground/50 transition-all"
                        />
                      </td>
                      {/* 現在のコメント */}
                      <td className="px-3 py-2.5 text-center text-muted-foreground text-sm tabular-nums">
                        {row.current_comments.toLocaleString()}
                      </td>
                      {/* 新しいコメント入力 */}
                      <td className="px-2 py-1.5 bg-amber-50/40">
                        <input
                          type="number"
                          min="0"
                          value={row.new_comments}
                          onChange={(e) => handleValueChange(row.id, 'new_comments', e.target.value)}
                          placeholder={row.current_comments.toString()}
                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-foreground text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 placeholder:text-muted-foreground/50 transition-all"
                        />
                      </td>
                      {/* 現在の検討コメント */}
                      <td className="px-3 py-2.5 text-center text-muted-foreground text-sm tabular-nums">
                        {row.current_consideration.toLocaleString()}
                      </td>
                      {/* 新しい検討コメント入力 */}
                      <td className="px-2 py-1.5 bg-amber-50/40">
                        <input
                          type="number"
                          min="0"
                          value={row.new_consideration}
                          onChange={(e) => handleValueChange(row.id, 'new_consideration', e.target.value)}
                          placeholder={row.current_consideration.toString()}
                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-foreground text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 placeholder:text-muted-foreground/50 transition-all"
                        />
                      </td>
                      {/* 投稿リンク */}
                      <td className="px-3 py-2.5 text-center">
                        {row.post_url ? (
                          <a
                            href={row.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-muted text-blue-500 hover:text-blue-600 transition-colors"
                            title={row.post_url}
                          >
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                      {/* 変更状態 */}
                      <td className="px-2 py-2.5 text-center">
                        {row.hasChanges && (
                          <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* フッターサマリー */}
        {filteredRows.length > 0 && (
          <div className="flex items-center justify-between text-sm px-1">
            <span className="text-muted-foreground">
              {filteredRows.length}件中 {changedCount}件を変更
            </span>
            {changedCount > 0 && (
              <span className="text-emerald-600 font-medium">
                保存ボタンで変更を反映
              </span>
            )}
          </div>
        )}
      </div>

      {/* 変更がある場合のフローティング保存バー */}
      {changedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between lg:ml-64">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-foreground font-medium">{changedCount}件の変更</span>
            <span className="text-muted-foreground">があります</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <RotateCcw size={14} />
              破棄
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 text-sm rounded-lg bg-foreground text-background hover:bg-foreground/90 font-medium transition-colors shadow-sm"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {changedCount}件を保存
            </button>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
