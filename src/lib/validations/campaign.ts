import { z } from 'zod';

// 案件登録フォームのバリデーションスキーマ
export const campaignSchema = z.object({
  // 基本情報
  influencer_id: z.string().min(1, 'インフルエンサーを選択してください'),
  brand: z.enum(['TL', 'BE', 'AM'], { required_error: 'ブランドを選択してください' }),
  staff_id: z.string().optional(),
  item_code: z.string().min(1, '品番を入力してください'),
  item_quantity: z.number().min(1, '枚数は1以上を入力してください'),

  // 日程
  sale_date: z.string().min(1, 'セール日を入力してください'),
  agreed_date: z.string().min(1, '打診日を入力してください'),
  post_date: z.string().optional(),
  desired_post_date_type: z.enum(['specific', 'range']).optional(),
  desired_post_date: z.string().optional(),
  desired_post_start_date: z.string().optional(),
  desired_post_end_date: z.string().optional(),

  // 金額
  status: z.enum(['pending', 'agree', 'disagree', 'cancelled'], {
    required_error: 'ステータスを選択してください',
  }),
  proposed_amount: z.number().min(0, '提示額は0以上を入力してください').optional(),
  agreed_amount: z.number().min(0, '合意額は0以上を入力してください').optional(),
  product_cost: z.number().min(0, '原価は0以上を入力してください').optional(),

  // 海外発送（BE専用）
  is_international_shipping: z.boolean().optional(),
  shipping_country: z.string().optional(),
  international_shipping_cost: z.number().min(0).optional(),

  // エンゲージメント（必須）
  likes: z.number().min(0, 'いいね数は0以上を入力してください'),
  comments: z.number().min(0, 'コメント数は0以上を入力してください'),
  consideration_comment: z.number().min(0, '検討コメントは0以上を入力してください'),
  engagement_date: z.string().min(1, '入力日を入力してください'),

  // 投稿情報
  post_url: z.string().url('有効なURLを入力してください').optional().or(z.literal('')),

  // メモ
  notes: z.string().optional(),
  newComment: z.string().optional(),
});

export type CampaignFormData = z.infer<typeof campaignSchema>;

// 必須フィールドのチェック用ヘルパー
export const getRequiredFieldsForStatus = (status: string) => {
  const baseRequired = [
    'influencer_id',
    'brand',
    'item_code',
    'item_quantity',
    'sale_date',
    'agreed_date',
    'likes',
    'comments',
    'consideration_comment',
    'engagement_date',
  ];

  // 合意の場合は合意額も必須
  if (status === 'agree') {
    return [...baseRequired, 'agreed_amount'];
  }

  return baseRequired;
};

// エラーメッセージを日本語化
export const errorMessages: Record<string, string> = {
  influencer_id: 'インフルエンサー',
  brand: 'ブランド',
  item_code: '品番',
  item_quantity: '枚数',
  sale_date: 'セール日',
  agreed_date: '打診日',
  likes: 'いいね数',
  comments: 'コメント数',
  consideration_comment: '検討コメント',
  engagement_date: '入力日',
  agreed_amount: '合意額',
};
