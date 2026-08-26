CREATE TABLE IF NOT EXISTS explorer_state (key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS blocks (
  height bigint PRIMARY KEY, hash text UNIQUE NOT NULL, parent_hash text NOT NULL, producer text,
  timestamp bigint NOT NULL, tx_count integer NOT NULL DEFAULT 0, size_bytes bigint NOT NULL DEFAULT 0,
  raw jsonb NOT NULL, indexed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS transactions (
  hash text PRIMARY KEY, block_height bigint NOT NULL REFERENCES blocks(height) ON DELETE CASCADE,
  tx_index integer NOT NULL, sender text NOT NULL, recipient text NOT NULL, value numeric(78,0) NOT NULL,
  fee numeric(78,0) NOT NULL DEFAULT 0, nonce bigint NOT NULL, raw jsonb NOT NULL,
  UNIQUE(block_height, tx_index)
);
CREATE INDEX IF NOT EXISTS transactions_sender_idx ON transactions(lower(sender), block_height DESC);
CREATE INDEX IF NOT EXISTS transactions_recipient_idx ON transactions(lower(recipient), block_height DESC);
CREATE INDEX IF NOT EXISTS transactions_height_idx ON transactions(block_height DESC, tx_index);
CREATE TABLE IF NOT EXISTS address_balances (
  address text PRIMARY KEY, balance numeric(78,0) NOT NULL, locked boolean NOT NULL DEFAULT false,
  tx_count bigint NOT NULL DEFAULT 0, first_seen_height bigint, last_seen_height bigint, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS address_balances_top_idx ON address_balances(balance DESC);
CREATE TABLE IF NOT EXISTS tokens (
  address text PRIMARY KEY, standard text NOT NULL CHECK (standard IN ('IEUM-20','IEUM-721','IEUM-1155')),
  name text, symbol text, decimals integer, total_supply numeric(78,0), metadata_uri text,
  verified boolean NOT NULL DEFAULT false, raw jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS token_transfers (
  id bigserial PRIMARY KEY, token_address text NOT NULL REFERENCES tokens(address), tx_hash text NOT NULL,
  block_height bigint NOT NULL, sender text, recipient text, token_id numeric(78,0), amount numeric(78,0), metadata_uri text
);
CREATE INDEX IF NOT EXISTS token_transfers_owner_idx ON token_transfers(lower(recipient), block_height DESC);
CREATE TABLE IF NOT EXISTS discovered_nodes (
  node_id text PRIMARY KEY, name text NOT NULL, rpc_url text, p2p_address text, version text, height bigint,
  peer_count integer, online boolean NOT NULL DEFAULT false, source_node_id text, last_seen_at timestamptz NOT NULL DEFAULT now(), raw jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS guilds (
  id bigserial PRIMARY KEY, name text UNIQUE NOT NULL, description text NOT NULL DEFAULT '', region text NOT NULL DEFAULT '',
  owner_wallet text NOT NULL, owner_aah_user text NOT NULL, level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS guild_members (
  guild_id bigint NOT NULL REFERENCES guilds(id) ON DELETE CASCADE, wallet text NOT NULL, aah_user text NOT NULL,
  rank integer NOT NULL DEFAULT 1 CHECK (rank BETWEEN 1 AND 5), joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (guild_id,wallet)
);
CREATE TABLE IF NOT EXISTS guild_events (
  id bigserial PRIMARY KEY, guild_id bigint NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  title text NOT NULL, description text NOT NULL DEFAULT '', starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS guild_payment_receipts (
  tx_hash text PRIMARY KEY, guild_id bigint UNIQUE REFERENCES guilds(id) ON DELETE RESTRICT,
  sender text NOT NULL, recipient text NOT NULL, amount numeric(78,0) NOT NULL, block_height bigint NOT NULL, verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS community_reports (
  id bigserial PRIMARY KEY, reporter_user text NOT NULL, reporter_wallet text, target_type text NOT NULL CHECK(target_type IN ('guild','member','event')),
  target_id text NOT NULL, reason text NOT NULL, evidence text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','reviewing','accepted','rejected')),
  reward_status text NOT NULL DEFAULT 'none' CHECK(reward_status IN ('none','candidate','approved','paid')), reviewer_note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz
);
CREATE TABLE IF NOT EXISTS ieum_purchase_orders (
  id bigserial PRIMARY KEY, user_id text NOT NULL, wallet_address text NOT NULL,
  amount_aah bigint NOT NULL CHECK(amount_aah BETWEEN 1 AND 1000000),
  amount_ieum bigint NOT NULL CHECK(amount_ieum=amount_aah), deposit_code text UNIQUE NOT NULL CHECK(deposit_code ~ '^[0-9]{8}$'),
  status text NOT NULL DEFAULT 'awaiting-deposit' CHECK(status IN ('awaiting-deposit','deposit-confirmed','paid','rejected')),
  deposit_confirmed_at timestamptz, payout_tx_hash text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ieum_purchase_orders_user_idx ON ieum_purchase_orders(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS ieum_vouchers (
  id uuid PRIMARY KEY, public_id text UNIQUE NOT NULL, code_hash text NOT NULL, token_hash text UNIQUE NOT NULL,
  amount_wei numeric(78,0) NOT NULL CHECK(amount_wei>0),
  status text NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','claiming','claimed','cancelled','expired','failed')),
  expires_at timestamptz, claimed_address text, payout_tx_hash text UNIQUE,
  claim_attempts integer NOT NULL DEFAULT 0, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), claimed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ieum_vouchers_status_idx ON ieum_vouchers(status,created_at DESC);
