-- Supabaseで実行するSQLスキーマ
-- ============================================
-- 注意: @clout.co.jp ドメインのみ認証を許可
-- ============================================

-- インフルエンサーテーブル
CREATE TABLE influencers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  insta_name VARCHAR(255) NOT NULL,
  insta_url TEXT,
  tiktok_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インフルエンサーのユニーク制約（insta_nameで重複防止）
CREATE UNIQUE INDEX idx_influencers_insta_name ON influencers(insta_name);

-- ギフティング案件テーブル
CREATE TABLE campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  brand VARCHAR(100),
  item_code VARCHAR(100), -- 品番
  item_quantity INTEGER DEFAULT 1, -- 枚数
  sale_date DATE, -- Date(sale)
  desired_post_date DATE, -- 投稿希望日
  agreed_date DATE, -- Date(Agreed)
  offered_amount DECIMAL(10, 2) DEFAULT 0, -- 提示額
  agreed_amount DECIMAL(10, 2) DEFAULT 0, -- 合意額
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'agree', 'disagree', 'cancelled')),
  post_status VARCHAR(100), -- Status of post (2 week after sale, Before sale等)
  post_date DATE, -- Date(Post)
  post_url TEXT, -- Post URL
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  consideration_comment INTEGER DEFAULT 0,
  number_of_times INTEGER DEFAULT 1, -- 回数
  notes TEXT,
  created_by UUID REFERENCES auth.users(id), -- 作成者
  updated_by UUID REFERENCES auth.users(id), -- 最終更新者
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ユーザープロフィールテーブル（表示名用）
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 新規ユーザー登録時に自動でプロフィール作成（ドメイン制限付き）
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  email_domain TEXT;
BEGIN
  -- メールドメインを抽出
  email_domain := LOWER(SPLIT_PART(NEW.email, '@', 2));

  -- @clout.co.jp ドメインのみ許可
  IF email_domain != 'clout.co.jp' THEN
    RAISE EXCEPTION 'Only @clout.co.jp email addresses are allowed';
  END IF;

  INSERT INTO public.user_profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, SPLIT_PART(NEW.email, '@', 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- user_profilesのRLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users" ON user_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable update for own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- インデックス
CREATE INDEX idx_campaigns_influencer ON campaigns(influencer_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_brand ON campaigns(brand);
CREATE INDEX idx_campaigns_post_date ON campaigns(post_date);

-- 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_influencers_updated_at
  BEFORE UPDATE ON influencers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) 設定
ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- 認証されたユーザーのみアクセス可能
CREATE POLICY "Enable read access for authenticated users" ON influencers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON influencers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON influencers
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON influencers
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON campaigns
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON campaigns
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON campaigns
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON campaigns
  FOR DELETE USING (auth.role() = 'authenticated');

-- ダッシュボード用のビュー
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  COUNT(DISTINCT c.id) as total_campaigns,
  COUNT(DISTINCT i.id) as total_influencers,
  COALESCE(SUM(c.agreed_amount), 0) as total_spent,
  COALESCE(SUM(c.likes), 0) as total_likes,
  COALESCE(SUM(c.comments), 0) as total_comments,
  COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN c.status = 'agree' THEN 1 END) as agree_count,
  COUNT(CASE WHEN c.status = 'disagree' THEN 1 END) as disagree_count,
  COUNT(CASE WHEN c.status = 'cancelled' THEN 1 END) as cancelled_count
FROM campaigns c
LEFT JOIN influencers i ON c.influencer_id = i.id;

-- ブランド別統計ビュー
CREATE OR REPLACE VIEW brand_stats AS
SELECT
  brand,
  COUNT(*) as campaign_count,
  COALESCE(SUM(agreed_amount), 0) as total_amount,
  COALESCE(SUM(likes), 0) as total_likes,
  COALESCE(SUM(comments), 0) as total_comments
FROM campaigns
WHERE brand IS NOT NULL AND brand != ''
GROUP BY brand
ORDER BY total_amount DESC;

-- 月別統計ビュー
CREATE OR REPLACE VIEW monthly_stats AS
SELECT
  TO_CHAR(post_date, 'YYYY-MM') as month,
  COUNT(*) as campaign_count,
  COALESCE(SUM(agreed_amount), 0) as total_amount,
  COALESCE(SUM(likes), 0) as total_likes,
  COALESCE(SUM(comments), 0) as total_comments
FROM campaigns
WHERE post_date IS NOT NULL
GROUP BY TO_CHAR(post_date, 'YYYY-MM')
ORDER BY month DESC;
