-- ============================================
-- Migration: SSO移行に伴う auth.users FK 制約の削除
-- Date: 2026-02-11
-- Reason: SSO一本化後、auth.users テーブルにレコードが存在しないため
--         created_by / updated_by の FK制約が INSERT を阻害する可能性がある。
--         BFF API (service_role) 経由で書き込む場合も FK 制約は
--         バイパスされないため、制約を削除する必要がある。
-- ============================================

-- 1. campaigns.created_by の FK 制約を削除
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_created_by_fkey;

-- 2. campaigns.updated_by の FK 制約を削除
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_updated_by_fkey;

-- 3. user_profiles.id の FK 制約を削除
--    注意: user_profiles は auth.users(id) を PK兼FK としていた。
--    SSO移行後は Clout SSO ユーザーIDをPKとして使うため、FK を外す。
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_pkey;
ALTER TABLE user_profiles ADD PRIMARY KEY (id);

-- 4. created_by / updated_by を TEXT に変更（SSO user ID は UUID 形式ではない可能性）
ALTER TABLE campaigns ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE campaigns ALTER COLUMN updated_by TYPE TEXT USING updated_by::TEXT;

-- 5. user_profiles.id を TEXT に変更
ALTER TABLE user_profiles ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- 6. auth.users トリガーを削除（SSO移行後は不要）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 7. RLS ポリシーを service_role 互換に変更
--    service_role はすべてのRLSをバイパスするが、
--    クライアントが直接アクセスする場合に備えて 'authenticated' OR 'service_role' にする
--    ※ 実際にはBFF経由なのでservice_roleがバイパスする
-- (既存のRLSはそのまま残す — service_roleはRLSをバイパスする)
