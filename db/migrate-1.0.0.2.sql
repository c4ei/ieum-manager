CREATE TABLE IF NOT EXISTS ieum_purchase_orders (
  id bigserial PRIMARY KEY, user_id text NOT NULL, wallet_address text NOT NULL,
  amount_aah bigint NOT NULL CHECK(amount_aah BETWEEN 1 AND 1000000),
  amount_ieum bigint NOT NULL CHECK(amount_ieum=amount_aah), deposit_code text UNIQUE NOT NULL CHECK(deposit_code ~ '^[0-9]{8}$'),
  status text NOT NULL DEFAULT 'awaiting-deposit' CHECK(status IN ('awaiting-deposit','deposit-confirmed','paid','rejected')),
  deposit_confirmed_at timestamptz, payout_tx_hash text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ieum_purchase_orders_user_idx ON ieum_purchase_orders(user_id,created_at DESC);
