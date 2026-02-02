'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Campaign, Influencer, CampaignFormData } from '@/types';
import { X, Loader2, User, Calendar, MessageSquare, Plus, Tag } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import TagInput, { SUGGESTED_TAGS } from '@/components/ui/TagInput';
import QuickTemplates, { QuickAmountButtons, QuickDateButtons } from '@/components/ui/QuickTemplates';

interface CampaignModalProps {
  campaign: Campaign | null;
  influencers: Influencer[];
  onClose: () => void;
  onSave: () => void;
}

export default function CampaignModal({
  campaign,
  influencers,
  onClose,
  onSave,
}: CampaignModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<CampaignFormData>({
    influencer_id: campaign?.influencer_id || '',
    brand: campaign?.brand || '',
    item_code: campaign?.item_code || '',
    item_quantity: campaign?.item_quantity || 1,
    sale_date: campaign?.sale_date || '',
    desired_post_date: campaign?.desired_post_date || '',
    agreed_date: campaign?.agreed_date || '',
    offered_amount: campaign?.offered_amount || 0,
    agreed_amount: campaign?.agreed_amount || 0,
    status: campaign?.status || 'pending',
    post_status: campaign?.post_status || '',
    post_date: campaign?.post_date || '',
    post_url: campaign?.post_url || '',
    likes: campaign?.likes || 0,
    comments: campaign?.comments || 0,
    consideration_comment: campaign?.consideration_comment || 0,
    number_of_times: campaign?.number_of_times || 1,
    notes: campaign?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // コメント機能用の状態
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<{ text: string; user: string; date: string }[]>([]);

  // タグの状態（notesからタグを抽出）
  const extractTags = (notes: string | null): string[] => {
    if (!notes) return [];
    const tagMatch = notes.match(/\[TAGS:(.*?)\]/);
    if (tagMatch) {
      return tagMatch[1].split(',').map(t => t.trim()).filter(Boolean);
    }
    return [];
  };

  const [tags, setTags] = useState<string[]>(extractTags(campaign?.notes || null));

  // テンプレート適用
  const handleTemplateSelect = (templateData: Partial<CampaignFormData>) => {
    setFormData(prev => ({ ...prev, ...templateData }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 既存のnotesにコメントを追加
      let updatedNotes = formData.notes || '';

      // 既存のTAGSを削除
      updatedNotes = updatedNotes.replace(/\[TAGS:.*?\]\n?/g, '');

      // タグを追加
      if (tags.length > 0) {
        updatedNotes = `[TAGS:${tags.join(',')}]\n${updatedNotes}`;
      }

      if (newComment.trim()) {
        const commentEntry = `\n[${new Date().toLocaleString('ja-JP')}] ${user?.email?.split('@')[0] || 'ユーザー'}: ${newComment}`;
        updatedNotes = updatedNotes + commentEntry;
      }

      const payload = {
        influencer_id: formData.influencer_id,
        brand: formData.brand || null,
        item_code: formData.item_code || null,
        item_quantity: formData.item_quantity || 1,
        sale_date: formData.sale_date || null,
        desired_post_date: formData.desired_post_date || null,
        agreed_date: formData.agreed_date || null,
        offered_amount: formData.offered_amount || 0,
        agreed_amount: formData.agreed_amount || 0,
        status: formData.status,
        post_status: formData.post_status || null,
        post_date: formData.post_date || null,
        post_url: formData.post_url || null,
        likes: formData.likes || 0,
        comments: formData.comments || 0,
        consideration_comment: formData.consideration_comment || 0,
        number_of_times: formData.number_of_times || 1,
        notes: updatedNotes || null,
        updated_by: user?.id,
      };

      if (campaign) {
        const { error } = await supabase
          .from('campaigns')
          .update(payload)
          .eq('id', campaign.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('campaigns').insert([{
          ...payload,
          created_by: user?.id,
        }]);
        if (error) throw error;
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // notesからコメント履歴を抽出
  const parseComments = (notes: string | null) => {
    if (!notes) return [];
    const lines = notes.split('\n').filter(line => line.startsWith('['));
    return lines.map(line => {
      const match = line.match(/\[(.+?)\] (.+?): (.+)/);
      if (match) {
        return { date: match[1], user: match[2], text: match[3] };
      }
      return null;
    }).filter(Boolean) as { date: string; user: string; text: string }[];
  };

  const existingComments = parseComments(campaign?.notes || null);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 flex items-center justify-between p-6 border-b dark:border-gray-800 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {campaign ? '案件編集' : '新規案件'}
            </h2>
            {!campaign && (
              <QuickTemplates onSelect={handleTemplateSelect} />
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* 作成者・更新者情報 */}
        {campaign && (
          <div className="px-6 py-3 bg-gray-50 border-b flex flex-wrap gap-4 text-sm text-gray-600">
            {campaign.created_at && (
              <div className="flex items-center gap-2">
                <Calendar size={14} />
                <span>作成: {formatDateTime(campaign.created_at)}</span>
                {campaign.creator && (
                  <span className="text-primary-600">({campaign.creator.display_name || campaign.creator.email})</span>
                )}
              </div>
            )}
            {campaign.updated_at && campaign.updated_at !== campaign.created_at && (
              <div className="flex items-center gap-2">
                <User size={14} />
                <span>更新: {formatDateTime(campaign.updated_at)}</span>
                {campaign.updater && (
                  <span className="text-primary-600">({campaign.updater.display_name || campaign.updater.email})</span>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 基本情報 */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">基本情報</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  インフルエンサー <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.influencer_id}
                  onChange={(e) =>
                    setFormData({ ...formData, influencer_id: e.target.value })
                  }
                  className="input-field"
                  required
                >
                  <option value="">選択してください</option>
                  {influencers.map((inf) => (
                    <option key={inf.id} value={inf.id}>
                      @{inf.insta_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ブランド
                </label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) =>
                    setFormData({ ...formData, brand: e.target.value })
                  }
                  className="input-field"
                  placeholder="TL"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  品番
                </label>
                <input
                  type="text"
                  value={formData.item_code}
                  onChange={(e) =>
                    setFormData({ ...formData, item_code: e.target.value })
                  }
                  className="input-field"
                  placeholder="TF-2408"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  枚数
                </label>
                <input
                  type="number"
                  value={formData.item_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, item_quantity: parseInt(e.target.value) || 1 })
                  }
                  className="input-field"
                  min={1}
                />
              </div>
            </div>
          </div>

          {/* 日程 */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">日程</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  セール日
                </label>
                <input
                  type="date"
                  value={formData.sale_date}
                  onChange={(e) =>
                    setFormData({ ...formData, sale_date: e.target.value })
                  }
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  投稿希望日
                </label>
                <input
                  type="date"
                  value={formData.desired_post_date}
                  onChange={(e) =>
                    setFormData({ ...formData, desired_post_date: e.target.value })
                  }
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  合意日
                </label>
                <input
                  type="date"
                  value={formData.agreed_date}
                  onChange={(e) =>
                    setFormData({ ...formData, agreed_date: e.target.value })
                  }
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* 金額・ステータス */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">金額・ステータス</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  提示額 (円)
                </label>
                <input
                  type="number"
                  value={formData.offered_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, offered_amount: parseFloat(e.target.value) || 0 })
                  }
                  className="input-field"
                  min={0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  合意額 (円)
                </label>
                <input
                  type="number"
                  value={formData.agreed_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, agreed_amount: parseFloat(e.target.value) || 0 })
                  }
                  className="input-field"
                  min={0}
                />
                <QuickAmountButtons
                  value={formData.agreed_amount}
                  onChange={(amount) => setFormData({ ...formData, agreed_amount: amount, offered_amount: amount })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ステータス
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as any })
                  }
                  className="input-field"
                >
                  <option value="pending">保留</option>
                  <option value="agree">合意</option>
                  <option value="disagree">不合意</option>
                  <option value="cancelled">キャンセル</option>
                </select>
              </div>
            </div>
          </div>

          {/* 投稿情報 */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">投稿情報</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  投稿ステータス
                </label>
                <select
                  value={formData.post_status}
                  onChange={(e) =>
                    setFormData({ ...formData, post_status: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">選択してください</option>
                  <option value="Before sale">Before sale</option>
                  <option value="2 week after sale">2 week after sale</option>
                  <option value="1 month after sale">1 month after sale</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  投稿日
                </label>
                <input
                  type="date"
                  value={formData.post_date}
                  onChange={(e) =>
                    setFormData({ ...formData, post_date: e.target.value })
                  }
                  className="input-field"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  投稿URL
                </label>
                <input
                  type="url"
                  value={formData.post_url}
                  onChange={(e) =>
                    setFormData({ ...formData, post_url: e.target.value })
                  }
                  className="input-field"
                  placeholder="https://www.tiktok.com/@..."
                />
              </div>
            </div>
          </div>

          {/* エンゲージメント */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">エンゲージメント</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  いいね数
                </label>
                <input
                  type="number"
                  value={formData.likes}
                  onChange={(e) =>
                    setFormData({ ...formData, likes: parseInt(e.target.value) || 0 })
                  }
                  className="input-field"
                  min={0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  コメント数
                </label>
                <input
                  type="number"
                  value={formData.comments}
                  onChange={(e) =>
                    setFormData({ ...formData, comments: parseInt(e.target.value) || 0 })
                  }
                  className="input-field"
                  min={0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  検討コメント
                </label>
                <input
                  type="number"
                  value={formData.consideration_comment}
                  onChange={(e) =>
                    setFormData({ ...formData, consideration_comment: parseInt(e.target.value) || 0 })
                  }
                  className="input-field"
                  min={0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  回数
                </label>
                <input
                  type="number"
                  value={formData.number_of_times}
                  onChange={(e) =>
                    setFormData({ ...formData, number_of_times: parseInt(e.target.value) || 1 })
                  }
                  className="input-field"
                  min={1}
                />
              </div>
            </div>
          </div>

          {/* コメント・メモ */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2 flex items-center gap-2">
              <MessageSquare size={18} />
              コメント・メモ
            </h3>

            {/* 既存のコメント履歴 */}
            {existingComments.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                {existingComments.map((comment, index) => (
                  <div key={index} className="text-sm">
                    <div className="flex items-center gap-2 text-gray-500">
                      <User size={12} />
                      <span className="font-medium">{comment.user}</span>
                      <span className="text-xs">{comment.date}</span>
                    </div>
                    <p className="text-gray-700 ml-4">{comment.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 新しいコメント入力 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新しいコメントを追加
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="コメントを入力..."
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newComment.trim()) {
                      const currentNotes = formData.notes || '';
                      const commentEntry = `\n[${new Date().toLocaleString('ja-JP')}] ${user?.email?.split('@')[0] || 'ユーザー'}: ${newComment}`;
                      setFormData({ ...formData, notes: currentNotes + commentEntry });
                      setNewComment('');
                    }
                  }}
                  className="btn-secondary p-2"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            {/* メモ欄 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                メモ
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="input-field"
                rows={3}
                placeholder="備考など..."
              />
            </div>
          </div>

          {/* タグ */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 dark:text-white border-b dark:border-gray-700 pb-2 flex items-center gap-2">
              <Tag size={18} />
              タグ
            </h3>
            <TagInput
              tags={tags}
              onChange={setTags}
              suggestions={SUGGESTED_TAGS}
              placeholder="タグを追加（高優先度、VIP、フォローアップなど）"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="animate-spin" size={20} />}
              {campaign ? '更新' : '登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
