ALTER TABLE ieum_vouchers ADD COLUMN IF NOT EXISTS secret_ciphertext text;
ALTER TABLE ieum_vouchers ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE ieum_vouchers ADD COLUMN IF NOT EXISTS cancelled_by text;
ALTER TABLE ieum_vouchers ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE ieum_vouchers ADD COLUMN IF NOT EXISTS print_access_count integer NOT NULL DEFAULT 0;
ALTER TABLE ieum_vouchers ADD COLUMN IF NOT EXISTS print_accessed_at timestamptz;
