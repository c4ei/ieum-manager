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
