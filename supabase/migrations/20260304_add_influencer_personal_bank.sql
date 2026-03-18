-- Add personal info and bank account fields to influencers table
-- Date: 2026-03-04
-- Reason: Consolidate Google Form/Spreadsheet billing data into GGCRM

-- Personal Info (本人情報・連絡先)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS real_name TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS email TEXT;

-- Bank Info (振込先情報)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT '普通';
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS account_holder TEXT;
