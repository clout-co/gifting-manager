-- Add invoice registration number and acknowledgment fields
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS invoice_registration_number TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS invoice_acknowledged BOOLEAN DEFAULT false;
