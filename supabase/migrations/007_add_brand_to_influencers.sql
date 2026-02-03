-- インフルエンサーテーブルにブランドカラムを追加
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS brand VARCHAR(10);

-- 既存データにデフォルトブランドを設定（TLをデフォルトに）
UPDATE influencers SET brand = 'TL' WHERE brand IS NULL;

-- 社員テーブルにチームカラムを追加
ALTER TABLE staffs ADD COLUMN IF NOT EXISTS team VARCHAR(10) DEFAULT 'TL';
ALTER TABLE staffs ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_influencers_brand ON influencers(brand);
CREATE INDEX IF NOT EXISTS idx_staffs_team ON staffs(team);
