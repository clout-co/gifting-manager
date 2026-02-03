// 管理者メールアドレス
export const ADMIN_EMAILS = [
  'taishi.sawada@clout.co.jp',
  's@clout.co.jp',
];

// チーム種別
export type TeamType = 'TL' | 'BE' | 'AM' | 'ADMIN';

// インフルエンサー（ブランド紐付け追加）
export interface Influencer {
  id: string;
  insta_name: string | null;
  insta_url: string | null;
  tiktok_name: string | null;
  tiktok_url: string | null;
  brand: string; // ブランド紐付け（TL, BE, AM）
  created_at: string;
  updated_at: string;
}

// 社員（担当者）- チーム紐付け追加
export interface Staff {
  id: string;
  user_id: string | null; // Supabase Auth ユーザーID
  name: string;
  email: string | null;
  team: TeamType; // 所属チーム（TL, BE, AM, ADMIN）
  department: string | null;
  position: string | null;
  is_active: boolean;
  is_admin: boolean; // 管理者フラグ
  created_at: string;
  updated_at: string;
}

// ユーザープロフィール
export interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

// ギフティング案件
export interface Campaign {
  id: string;
  influencer_id: string;
  brand: string;
  item_code: string; // 品番
  item_quantity: number; // 枚数
  sale_date: string | null; // Date(sale)
  desired_post_date: string | null; // 投稿希望日（単一日）
  desired_post_start: string | null; // 投稿希望期間（開始）
  desired_post_end: string | null; // 投稿希望期間（終了）
  agreed_date: string | null; // Date(Agreed)
  offered_amount: number; // 提示額
  agreed_amount: number; // 合意額
  status: 'pending' | 'agree' | 'disagree' | 'cancelled' | 'ignored'; // ステータス
  post_status: string | null; // Status of post (2 week after sale, Before sale等)
  post_date: string | null; // Date(Post)
  post_url: string | null; // Post URL
  likes: number | null;
  comments: number | null;
  consideration_comment: number | null;
  engagement_date: string | null; // エンゲージメント入力日
  number_of_times: number | null; // 回数
  product_cost: number; // 商品原価
  shipping_cost: number; // 送料（800円固定）
  // BE用海外発送フィールド
  is_international_shipping: boolean; // 海外発送フラグ
  shipping_country: string | null; // 発送先国
  international_shipping_cost: number | null; // 海外発送送料
  notes: string | null;
  staff_id: string | null; // 担当者ID
  created_by: string | null; // 作成者ID
  updated_by: string | null; // 最終更新者ID
  created_at: string;
  updated_at: string;
  influencer?: Influencer;
  staff?: Staff; // 担当者
  creator?: UserProfile; // 作成者プロフィール
  updater?: UserProfile; // 更新者プロフィール
}

// インフルエンサーランキング
export interface InfluencerRanking {
  influencer_id: string;
  insta_name: string;
  insta_url: string | null;
  tiktok_url: string | null;
  total_campaigns: number;
  total_likes: number;
  total_comments: number;
  total_engagement: number;
  total_amount: number;
  avg_likes_per_campaign: number;
  cost_per_like: number;
}

// 商品別統計
export interface ItemStats {
  item_code: string;
  campaign_count: number;
  total_likes: number;
  total_comments: number;
  total_amount: number;
  avg_engagement: number;
}

// ダッシュボード用統計
export interface DashboardStats {
  total_campaigns: number;
  total_influencers: number;
  total_spent: number;
  total_likes: number;
  total_comments: number;
  avg_engagement_rate: number;
  campaigns_by_status: {
    pending: number;
    agree: number;
    disagree: number;
    cancelled: number;
  };
  campaigns_by_brand: {
    brand: string;
    count: number;
    total_amount: number;
  }[];
  monthly_stats: {
    month: string;
    campaigns: number;
    amount: number;
    likes: number;
    comments: number;
  }[];
}

// フォーム用
export interface CampaignFormData {
  influencer_id: string;
  brand: string;
  item_code: string;
  item_quantity: number;
  sale_date: string;
  desired_post_date: string;
  desired_post_start: string;
  desired_post_end: string;
  agreed_date: string;
  offered_amount: number;
  agreed_amount: number;
  status: 'pending' | 'agree' | 'disagree' | 'cancelled' | 'ignored';
  post_status: string;
  post_date: string;
  post_url: string;
  likes: number;
  comments: number;
  consideration_comment: number;
  engagement_date: string;
  number_of_times: number;
  product_cost: number;
  shipping_cost: number;
  // BE用海外発送フィールド
  is_international_shipping: boolean;
  shipping_country: string;
  international_shipping_cost: number;
  notes: string;
  staff_id: string;
}

export interface StaffFormData {
  name: string;
  email: string;
  team: TeamType;
  department: string;
  position: string;
}

export interface InfluencerFormData {
  insta_name: string;
  insta_url: string;
  tiktok_name: string;
  tiktok_url: string;
  brand: string; // ブランド紐付け
}

// インポート用
export interface ImportRow {
  brand?: string;
  insta_name?: string;
  insta_url?: string;
  tiktok_name?: string;
  tiktok_url?: string;
  item_code?: string;
  sale_date?: string;
  desired_post_date?: string;
  desired_post_start?: string;
  desired_post_end?: string;
  agreed_date?: string;
  offered_amount?: number;
  agreed_amount?: number;
  status?: string;
  post_status?: string;
  post_date?: string;
  post_url?: string;
  likes?: number;
  comments?: number;
  consideration_comment?: number;
  engagement_date?: string;
  item_quantity?: number;
  number_of_times?: number;
  product_cost?: number;
  // BE用海外発送フィールド
  is_international_shipping?: boolean;
  shipping_country?: string;
  international_shipping_cost?: number;
  notes?: string;
}

// チーム・担当者機能用
export interface TeamMember {
  id: string;
  display_name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar_url?: string;
  created_at: string;
}

export interface CampaignComment {
  id: string;
  campaign_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: UserProfile;
}

export interface CampaignAssignment {
  id: string;
  campaign_id: string;
  user_id: string;
  assigned_at: string;
  user?: UserProfile;
}

// インフルエンサースコアリング用
export interface InfluencerScore {
  influencer_id: string;
  insta_name: string;
  overall_score: number; // 0-100
  engagement_score: number;
  cost_efficiency_score: number;
  reliability_score: number;
  total_campaigns: number;
  avg_likes: number;
  avg_cost_per_like: number;
  agreement_rate: number;
  on_time_rate: number;
  tags: string[];
  is_favorite: boolean;
  is_blacklisted: boolean;
  last_campaign_date: string | null;
}

// カレンダーイベント用
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'post' | 'deadline' | 'sale' | 'meeting';
  campaign_id?: string;
  influencer_name?: string;
  color?: string;
}
