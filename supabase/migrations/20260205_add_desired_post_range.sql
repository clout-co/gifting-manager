-- Add desired_post_start and desired_post_end columns for date range selection
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS desired_post_start DATE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS desired_post_end DATE;
