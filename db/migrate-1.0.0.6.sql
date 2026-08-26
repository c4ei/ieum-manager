ALTER TABLE ieum_vouchers ADD COLUMN IF NOT EXISTS payout_nonce bigint;
ALTER TABLE ieum_vouchers ADD COLUMN IF NOT EXISTS payout_raw_tx text;
ALTER TABLE ieum_vouchers ADD COLUMN IF NOT EXISTS payout_expected_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS ieum_vouchers_expected_hash_idx
  ON ieum_vouchers(payout_expected_hash) WHERE payout_expected_hash IS NOT NULL;
