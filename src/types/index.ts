// インフルエンサー
export interface Influencer {
  id: string;
  insta_name: string;
  insta_url: string | null;
  tiktok_url: string | null;
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
  desired_post_date: string | null; // 投稿希望日
  agreed_date: string | null; // Date(Agreed)
  offered_amount: number; // 提示額
  agreed_amount: number; // 合意額
  status: 'pending' | 'agree' | 'disagree' | 'cancelled'; // ステータス
  post_status: string | null; // Status of post (2 week after sale, Before sale等)
  post_date: string | null; // Date(Post)
  post_url: string | null; // Post URL
  likes: number | null;
  comments: number | null;
  consideration_comment: number | null;
  number_of_times: number | null; // 回数
  notes: string | null;
  created_by: string | null; // 作成者ID
  updated_by: string | null; // 最終更新者ID
  created_at: string;
  updated_at: string;
  influencer?: Influencer;
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
  agreed_date: string;
  offered_amount: number;
  agreed_amount: number;
  status: 'pending' | 'agree' | 'disagree' | 'cancelled';
  post_status: string;
  post_date: string;
  post_url: string;
  likes: number;
  comments: number;
  consideration_comment: number;
  number_of_times: number;
  notes: string;
}

export interface InfluencerFormData {
  insta_name: string;
  insta_url: string;
  tiktok_url: string;
}

// インポート用
export interface ImportRow {
  brand?: string;
  insta_name?: string;
  insta_url?: string;
  tiktok_url?: string;
  item_code?: string;
  sale_date?: string;
  desired_post_date?: string;
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
  item_quantity?: number;
  number_of_times?: number;
  notes?: string;
}
