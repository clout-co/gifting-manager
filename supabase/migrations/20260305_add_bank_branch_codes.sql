-- Add bank_code and branch_code columns for accurate bank information
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS bank_code TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS branch_code TEXT;
