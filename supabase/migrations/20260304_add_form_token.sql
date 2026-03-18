-- Add form token columns to influencers table for public form workflow
-- Date: 2026-03-04
-- Reason: Replace Google Forms with self-hosted influencer info collection form

ALTER TABLE influencers ADD COLUMN IF NOT EXISTS form_token TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS form_token_expires_at TIMESTAMPTZ;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS form_token_used_at TIMESTAMPTZ;

-- Unique index on form_token for O(1) lookups by token
CREATE UNIQUE INDEX IF NOT EXISTS idx_influencers_form_token
  ON influencers(form_token)
  WHERE form_token IS NOT NULL;
