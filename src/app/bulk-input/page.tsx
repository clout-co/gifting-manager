'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useCampaigns, useBulkUpdateCampaigns } from '@/hooks/useQueries';
import { useToast } from '@/lib/toast';
import {
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Instagram,
  Youtube,
  Music2,
  RotateCcw,
} from 'lucide-react';

interface EditableRow {
  id: string;
  influencer_username: string;
  platform: string;
  product: string;
  current_likes: number;
  current_comments: number;
  new_likes: number | '';
  new_comments: number | '';
  hasChanges: boolean;
}

const platformIcon = (platform: string) => {
  switch (platform?.toLowerCase()) {
    case 'instagram':
      return <Instagram size={14} className="text-pink-400" />;
    case 'youtube':
      return <Youtube size={14} className="text-red-400" />;
    case 'tiktok':
      return <Music2 size={14} className="text-cyan-400" />;
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

  // 案件データを編集可能な行に変換
  useEffect(() => {
    if (campaigns) {
      const editableRows: EditableRow[] = campaigns
        .filter((c) => c.status === 'agree' || c.status === 'pending')
        .map((c) => ({
          id: c.id,
          influencer_username: (c.influencer as any)?.insta_name || (c.influencer as any)?.tiktok_name || '不明',
          platform: (c.influencer as any)?.insta_url ? 'instagram' : (c.influencer as any)?.tiktok_url ? 'tiktok' : '',
          product: c.item_code || '',
          current_likes: c.likes || 0,
          current_comments: c.comments || 0,
          new_likes: '',
          new_comments: '',
          hasChanges: false,
        }));
      setRows(editableRows);
    }
  }, [campaigns]);

  // フィルタリング
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

  // 値の更新
  const handleValueChange = (id: string, field: 'new_likes' | 'new_comments', value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          const numValue = value === '' ? '' : parseInt(value, 10) || 0;
          const updated = { ...row, [field]: numValue };
          updated.hasChanges =
            (updated.new_likes !== '' && updated.new_likes !== updated.current_likes) ||
            (updated.new_comments !== '' && updated.new_comments !== updated.current_comments);
          return updated;
        }
        return row;
      })
    );
  };

  // 一括保存
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
        input_date: new Date().toISOString().split('T')[0],
        status: 'agree' as const, // いいね/コメント入力時は自動で合意に
      }));

      await bulkUpdate.mutateAsync(updates.filter((u) => u.likes !== undefined || u.comments !== undefined));
      showToast('success', `${changedRows.length}件のデータを更新しました`);
      refetch();
    } catch (err) {
      showToast('error', '更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // リセット
  const handleReset = () => {
    if (campaigns) {
      const editableRows: EditableRow[] = campaigns
        .filter((c) => c.status === 'agree' || c.status === 'pending')
        .map((c) => ({
          id: c.id,
          influencer_username: (c.influencer as any)?.insta_name || (c.influencer as any)?.tiktok_name || '不明',
          platform: (c.influencer as any)?.insta_url ? 'instagram' : (c.influencer as any)?.tiktok_url ? 'tiktok' : '',
          product: c.item_code || '',
          current_likes: c.likes || 0,
          current_comments: c.comments || 0,
          new_likes: '',
          new_comments: '',
          hasChanges: false,
        }));
      setRows(editableRows);
    }
  };

  const changedCount = rows.filter((r) => r.hasChanges).length;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-white" size={32} />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px] text-red-400">
          <AlertCircle className="mr-2" />
          データの読み込みに失敗しました
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">一括エンゲージメント入力</h1>
            <p className="text-gray-400 text-sm mt-1">
              複数の案件のいいね数・コメント数を一括で更新できます
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
            >
              <RotateCcw size={16} />
              リセット
            </button>
            <button
              onClick={handleSave}
              disabled={changedCount === 0 || isSaving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                changedCount > 0
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : 'bg-white/20 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {changedCount > 0 ? `${changedCount}件を保存` : '保存'}
            </button>
          </div>
        </div>

        {/* フィルター */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              placeholder="インフルエンサー名・商品名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[oklch(0.205_0_0)] border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30"
            />
          </div>
          <div className="relative">
            <Filter
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 bg-[oklch(0.205_0_0)] border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/30 appearance-none cursor-pointer"
            >
              <option value="all">すべて</option>
              <option value="no-data">未入力のみ</option>
              <option value="with-data">入力済みのみ</option>
            </select>
          </div>
        </div>

        {/* テーブル */}
        <div className="bg-[oklch(0.205_0_0)] rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[oklch(0.18_0_0)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    インフルエンサー
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    商品
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    現在のいいね
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    新しいいいね
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    現在のコメント
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    新しいコメント
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">
                    状態
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      対象の案件がありません
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        row.hasChanges ? 'bg-emerald-500/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {platformIcon(row.platform)}
                          <span className="text-white text-sm">{row.influencer_username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">
                        {row.product || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400 text-sm tabular-nums">
                        {row.current_likes.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={row.new_likes}
                          onChange={(e) => handleValueChange(row.id, 'new_likes', e.target.value)}
                          placeholder={row.current_likes.toString()}
                          className="w-24 mx-auto block px-3 py-1.5 bg-[oklch(0.18_0_0)] border border-white/10 rounded-lg text-white text-center text-sm focus:outline-none focus:border-white/30 placeholder:text-gray-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400 text-sm tabular-nums">
                        {row.current_comments.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={row.new_comments}
                          onChange={(e) => handleValueChange(row.id, 'new_comments', e.target.value)}
                          placeholder={row.current_comments.toString()}
                          className="w-24 mx-auto block px-3 py-1.5 bg-[oklch(0.18_0_0)] border border-white/10 rounded-lg text-white text-center text-sm focus:outline-none focus:border-white/30 placeholder:text-gray-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.hasChanges && (
                          <CheckCircle2 size={18} className="text-emerald-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* サマリー */}
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            {filteredRows.length}件中 {changedCount}件を変更
          </span>
          {changedCount > 0 && (
            <span className="text-emerald-400">
              保存ボタンをクリックして変更を反映してください
            </span>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
