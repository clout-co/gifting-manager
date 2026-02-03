'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Campaign, Influencer, CampaignFormData, Staff } from '@/types';
import { X, Loader2, User, Calendar, MessageSquare, Plus, Tag, Globe, Plane } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import TagInput, { SUGGESTED_TAGS } from '@/components/ui/TagInput';
import QuickTemplates, { QuickAmountButtons, QuickDateButtons } from '@/components/ui/QuickTemplates';
import { useBrand } from '@/contexts/BrandContext';
import { useToast, translateError } from '@/lib/toast';

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
  const { currentBrand } = useBrand();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<CampaignFormData>({
    influencer_id: campaign?.influencer_id || '',
    brand: campaign?.brand || currentBrand, // 現在のブランドを自動設定
    item_code: campaign?.item_code || '',
    item_quantity: campaign?.item_quantity || 1,
    sale_date: campaign?.sale_date || '',
    desired_post_date: campaign?.desired_post_date || '',
    desired_post_start: campaign?.desired_post_start || '',
    desired_post_end: campaign?.desired_post_end || '',
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
    engagement_date: campaign?.engagement_date || '',
    number_of_times: campaign?.number_of_times || 1,
    product_cost: campaign?.product_cost ?? 0,
    shipping_cost: 800, // 送料は800円固定
    is_international_shipping: campaign?.is_international_shipping ?? false,
    shipping_country: campaign?.shipping_country || '',
    international_shipping_cost: campaign?.international_shipping_cost ?? 0,
    notes: campaign?.notes || '',
    staff_id: campaign?.staff_id || '',
  });

  // 担当者リストを取得
  const [staffs, setStaffs] = useState<Staff[]>([]);
  useEffect(() => {
    const fetchStaffs = async () => {
      const { data } = await supabase
        .from('staffs')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (data) setStaffs(data);
    };
    fetchStaffs();
  }, []);

  // 回数を自動計算（インフルエンサーとの過去の案件数）
  const [numberOfTimes, setNumberOfTimes] = useState<number>(campaign?.number_of_times || 1);
  useEffect(() => {
    const fetchNumberOfTimes = async () => {
      if (!formData.influencer_id) {
        setNumberOfTimes(1);
        return;
      }

      const { count, error } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('influencer_id', formData.influencer_id)
        .eq('brand', currentBrand);

      if (!error && count !== null) {
        // 新規登録の場合は+1、編集の場合はそのまま
        setNumberOfTimes(campaign ? count : count + 1);
      }
    };
    fetchNumberOfTimes();
  }, [formData.influencer_id, currentBrand, campaign]);

  // よくある海外発送先国リスト
  const COMMON_COUNTRIES = [
    '韓国', '中国', '台湾', '香港', 'タイ', 'シンガポール', 'マレーシア', 'フィリピン',
    'アメリカ', 'カナダ', 'イギリス', 'フランス', 'ドイツ', 'オーストラリア',
  ];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 投稿希望日の入力モード（single: 単一日, range: 期間）
  const [postDateMode, setPostDateMode] = useState<'single' | 'range'>(
    campaign?.desired_post_start && campaign?.desired_post_end ? 'range' : 'single'
  );

  // 投稿ステータスを自動計算（詳細カテゴリ）
  const calculatePostStatus = (saleDate: string, postDate: string, desiredDate: string, desiredStart: string, desiredEnd: string): string => {
    if (!saleDate) return '';
    if (postDate) return '投稿済み';

    const sale = new Date(saleDate);
    const targetDate = desiredDate ? new Date(desiredDate) :
                       desiredStart ? new Date(desiredStart) : null;

    if (!targetDate) return '';

    // セール日からの日数差（マイナス = セール前、プラス = セール後）
    const daysDiff = Math.floor((targetDate.getTime() - sale.getTime()) / (1000 * 60 * 60 * 24));

    // セール前
    if (daysDiff < 0) {
      if (daysDiff >= -7) {
        return 'セール1週間前';
      } else if (daysDiff >= -14) {
        return 'セール2週間前';
      } else {
        return 'セール2週間以上前';
      }
    }

    // セール当日
    if (daysDiff === 0) {
      return 'セール当日';
    }

    // セール後
    if (daysDiff <= 3) {
      return 'セール3日以内';
    } else if (daysDiff <= 7) {
      return 'セール1週間以内';
    } else if (daysDiff <= 14) {
      return 'セール2週間以内';
    } else if (daysDiff <= 21) {
      return 'セール3週間以内';
    } else if (daysDiff <= 30) {
      return 'セール1ヶ月以内';
    } else if (daysDiff <= 60) {
      return 'セール2ヶ月以内';
    } else {
      return 'セール2ヶ月以上後';
    }
  };

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

      // 投稿ステータスを自動計算
      const autoPostStatus = calculatePostStatus(
        formData.sale_date,
        formData.post_date,
        formData.desired_post_date,
        formData.desired_post_start,
        formData.desired_post_end
      );

      const payload = {
        influencer_id: formData.influencer_id,
        brand: formData.brand || null,
        item_code: formData.item_code || null,
        item_quantity: formData.item_quantity || 1,
        sale_date: formData.sale_date || null,
        desired_post_date: postDateMode === 'single' ? (formData.desired_post_date || null) : null,
        desired_post_start: postDateMode === 'range' ? (formData.desired_post_start || null) : null,
        desired_post_end: postDateMode === 'range' ? (formData.desired_post_end || null) : null,
        agreed_date: formData.agreed_date || null,
        offered_amount: formData.offered_amount || 0,
        agreed_amount: formData.agreed_amount || 0,
        status: formData.status,
        post_status: autoPostStatus || null,
        post_date: formData.post_date || null,
        post_url: formData.post_url || null,
        likes: formData.likes || 0,
        comments: formData.comments || 0,
        consideration_comment: formData.consideration_comment || 0,
        engagement_date: formData.engagement_date || null,
        number_of_times: numberOfTimes || 1,
        product_cost: formData.product_cost || 0,
        shipping_cost: 800, // 送料は800円固定
        is_international_shipping: formData.is_international_shipping || false,
        shipping_country: formData.is_international_shipping ? (formData.shipping_country || null) : null,
        international_shipping_cost: formData.is_international_shipping ? (formData.international_shipping_cost || null) : null,
        notes: updatedNotes || null,
        staff_id: formData.staff_id || null,
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

      showToast('success', campaign ? '案件を更新しました' : '案件を登録しました');
      onSave();
    } catch (err: unknown) {
      const errorMessage = translateError(err);
      setError(errorMessage);
      showToast('error', errorMessage);
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
                      @{inf.insta_name || inf.tiktok_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ブランド <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.brand}
                  onChange={(e) =>
                    setFormData({ ...formData, brand: e.target.value })
                  }
                  className="input-field"
                  required
                  disabled
                >
                  <option value="TL">TL (That&apos;s life)</option>
                  <option value="BE">BE (Belvet)</option>
                  <option value="AM">AM (Antimid)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">※サイドバーで切り替え</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  担当者
                </label>
                <select
                  value={formData.staff_id}
                  onChange={(e) =>
                    setFormData({ ...formData, staff_id: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">選択してください</option>
                  {staffs.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}{staff.department ? ` (${staff.department})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  品番 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.item_code}
                  onChange={(e) =>
                    setFormData({ ...formData, item_code: e.target.value })
                  }
                  className="input-field"
                  placeholder="TF-2408"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  枚数 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.item_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, item_quantity: parseInt(e.target.value) || 1 })
                  }
                  className="input-field"
                  min={1}
                  required
                />
              </div>
            </div>
          </div>

          {/* 日程 */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">日程</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  セール日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.sale_date}
                  onChange={(e) =>
                    setFormData({ ...formData, sale_date: e.target.value })
                  }
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  打診日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.agreed_date}
                  onChange={(e) =>
                    setFormData({ ...formData, agreed_date: e.target.value })
                  }
                  className="input-field"
                  required
                />
              </div>
            </div>

            {/* 投稿希望日/期間 */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">投稿希望</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPostDateMode('single')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                      postDateMode === 'single'
                        ? 'bg-gray-800 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    特定日
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostDateMode('range')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                      postDateMode === 'range'
                        ? 'bg-gray-800 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    期間指定
                  </button>
                </div>
              </div>

              {postDateMode === 'single' ? (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
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
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      開始日
                    </label>
                    <input
                      type="date"
                      value={formData.desired_post_start}
                      onChange={(e) =>
                        setFormData({ ...formData, desired_post_start: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      終了日
                    </label>
                    <input
                      type="date"
                      value={formData.desired_post_end}
                      onChange={(e) =>
                        setFormData({ ...formData, desired_post_end: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                </div>
              )}

              {/* 自動計算された投稿ステータスを表示 */}
              {formData.sale_date && (formData.desired_post_date || formData.desired_post_start) && (
                <div className="text-sm text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-200">
                  <span className="font-medium">投稿ステータス（自動）: </span>
                  <span className="text-gray-800 font-medium">
                    {calculatePostStatus(
                      formData.sale_date,
                      formData.post_date,
                      formData.desired_post_date,
                      formData.desired_post_start,
                      formData.desired_post_end
                    ) || '未設定'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 金額・ステータス */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">金額・ステータス</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                  商品原価 (円)
                </label>
                <input
                  type="number"
                  value={formData.product_cost}
                  onChange={(e) =>
                    setFormData({ ...formData, product_cost: parseFloat(e.target.value) || 0 })
                  }
                  className="input-field"
                  min={0}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  送料 (円)
                </label>
                <input
                  type="number"
                  value={800}
                  disabled
                  className="input-field bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">固定: ¥800</p>
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
                  <option value="ignored">無視</option>
                </select>
              </div>
            </div>
          </div>

          {/* BE用海外発送設定 */}
          {currentBrand === 'BE' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2 flex items-center gap-2">
                <Globe size={18} className="text-gray-500" />
                海外発送設定（BEブランド）
              </h3>

              <div className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_international_shipping}
                    onChange={(e) => setFormData({ ...formData, is_international_shipping: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-400 text-gray-800 focus:ring-gray-500"
                  />
                  <span className="font-medium text-gray-800 flex items-center gap-2">
                    <Plane size={16} />
                    海外発送案件として登録
                  </span>
                </label>

                {formData.is_international_shipping && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        発送先国
                      </label>
                      <select
                        value={formData.shipping_country}
                        onChange={(e) => setFormData({ ...formData, shipping_country: e.target.value })}
                        className="input-field text-sm"
                      >
                        <option value="">選択してください</option>
                        {COMMON_COUNTRIES.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                        <option value="その他">その他</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        海外発送送料（円）
                      </label>
                      <input
                        type="number"
                        value={formData.international_shipping_cost}
                        onChange={(e) => setFormData({ ...formData, international_shipping_cost: parseInt(e.target.value) || 0 })}
                        className="input-field text-sm"
                        min={0}
                        placeholder="2000"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 投稿情報 */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">投稿情報（実績）</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  実際の投稿日
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

              <div>
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

          {/* エンゲージメント（合意後のみ入力可能・必須） */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-medium text-gray-900">エンゲージメント</h3>
              {formData.status !== 'agree' && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  合意後に入力可能
                </span>
              )}
            </div>

            {formData.status === 'agree' ? (
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
                    入力日
                  </label>
                  <input
                    type="date"
                    value={formData.engagement_date}
                    onChange={(e) =>
                      setFormData({ ...formData, engagement_date: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
                ステータスを「合意」に変更するとエンゲージメント情報を入力できます
              </div>
            )}

            {/* 回数（自動計算）*/}
            {formData.influencer_id && (
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-sm text-gray-600">回数（このインフルエンサーとの{currentBrand}案件）: </span>
                <span className="font-bold text-gray-900">{numberOfTimes}回目</span>
              </div>
            )}
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
