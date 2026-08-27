CREATE TABLE IF NOT EXISTS ieum_trial_campaigns (
  id uuid PRIMARY KEY, public_id text UNIQUE NOT NULL, name text NOT NULL,
  status text NOT NULL DEFAULT 'paused' CHECK(status IN ('draft','active','paused','ended')),
  reward_wei numeric(78,0) NOT NULL CHECK(reward_wei>0), budget_wei numeric(78,0) NOT NULL CHECK(budget_wei>0),
  spent_wei numeric(78,0) NOT NULL DEFAULT 0 CHECK(spent_wei>=0), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  ip_daily_limit integer NOT NULL DEFAULT 1 CHECK(ip_daily_limit BETWEEN 1 AND 100), device_daily_limit integer NOT NULL DEFAULT 1 CHECK(device_daily_limit BETWEEN 1 AND 100),
  burst_limit integer NOT NULL DEFAULT 3 CHECK(burst_limit BETWEEN 1 AND 100), minimum_wait_seconds integer NOT NULL DEFAULT 15 CHECK(minimum_wait_seconds BETWEEN 0 AND 3600),
  captcha_required boolean NOT NULL DEFAULT true, created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ieum_trial_budget_events (id bigserial PRIMARY KEY,campaign_id uuid NOT NULL REFERENCES ieum_trial_campaigns(id),amount_wei numeric(78,0) NOT NULL CHECK(amount_wei>0),reason text NOT NULL,actor text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS ieum_trial_claims (
  id uuid PRIMARY KEY,campaign_id uuid NOT NULL REFERENCES ieum_trial_campaigns(id),address text NOT NULL,ip_hash text NOT NULL,device_hash text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','paying','paid','rejected','failed')),risk_reason text,payout_nonce bigint,payout_raw_tx text,payout_expected_hash text UNIQUE,payout_tx_hash text UNIQUE,last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),paid_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(campaign_id,address)
);
CREATE INDEX IF NOT EXISTS ieum_trial_claims_campaign_idx ON ieum_trial_claims(campaign_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ieum_trial_claims_ip_idx ON ieum_trial_claims(campaign_id,ip_hash,created_at DESC);
CREATE INDEX IF NOT EXISTS ieum_trial_claims_device_idx ON ieum_trial_claims(campaign_id,device_hash,created_at DESC);
