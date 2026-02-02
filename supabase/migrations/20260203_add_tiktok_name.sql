-- Add tiktok_name column and make insta_name nullable
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS tiktok_name TEXT;
ALTER TABLE influencers ALTER COLUMN insta_name DROP NOT NULL;
