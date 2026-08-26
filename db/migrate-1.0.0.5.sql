CREATE TABLE IF NOT EXISTS ieum_vouchers (
  id uuid PRIMARY KEY, public_id text UNIQUE NOT NULL, code_hash text NOT NULL, token_hash text UNIQUE NOT NULL,
  amount_wei numeric(78,0) NOT NULL CHECK(amount_wei>0),
  status text NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','claiming','claimed','cancelled','expired','failed')),
  expires_at timestamptz, claimed_address text, payout_tx_hash text UNIQUE,
  claim_attempts integer NOT NULL DEFAULT 0, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), claimed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ieum_vouchers_status_idx ON ieum_vouchers(status,created_at DESC);
