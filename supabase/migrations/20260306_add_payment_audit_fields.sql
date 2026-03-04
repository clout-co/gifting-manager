-- 支払い承認の監査ログ強化: 承認者メールの記録
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS approved_by_email TEXT;

-- 承認者メールのインデックス（監査クエリ用）
CREATE INDEX IF NOT EXISTS idx_campaigns_approved_by_email ON campaigns(approved_by_email);
