ALTER TABLE ieum_trial_claims DROP CONSTRAINT IF EXISTS ieum_trial_claims_status_check;
ALTER TABLE ieum_trial_claims DROP CONSTRAINT IF EXISTS ieum_trial_claims_campaign_id_address_key;
ALTER TABLE ieum_trial_claims ADD CONSTRAINT ieum_trial_claims_status_check
  CHECK(status IN ('pending_email','queued','paying','paid','rejected','failed','expired'));
ALTER TABLE ieum_trial_claims ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE ieum_trial_claims ADD COLUMN IF NOT EXISTS email_hash text;
ALTER TABLE ieum_trial_claims ADD COLUMN IF NOT EXISTS email_verification_token_hash text;
ALTER TABLE ieum_trial_claims ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamptz;
ALTER TABLE ieum_trial_claims ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE ieum_trial_claims ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz;
ALTER TABLE ieum_trial_claims ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false;
ALTER TABLE ieum_trial_claims ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;
ALTER TABLE ieum_trial_claims ADD COLUMN IF NOT EXISTS ip_address inet;
ALTER TABLE ieum_trial_claims ADD COLUMN IF NOT EXISTS country_code char(2);
ALTER TABLE ieum_trial_claims ADD COLUMN IF NOT EXISTS target_tags text[] NOT NULL DEFAULT '{}';
DROP INDEX IF EXISTS ieum_trial_claims_campaign_email_idx;
CREATE UNIQUE INDEX ieum_trial_claims_campaign_email_idx ON ieum_trial_claims(campaign_id,email_hash) WHERE email_hash IS NOT NULL AND status NOT IN ('rejected','expired','failed');
CREATE UNIQUE INDEX IF NOT EXISTS ieum_trial_claims_campaign_address_active_idx ON ieum_trial_claims(campaign_id,address) WHERE status NOT IN ('rejected','expired','failed');
CREATE UNIQUE INDEX IF NOT EXISTS ieum_trial_claims_email_token_idx ON ieum_trial_claims(email_verification_token_hash) WHERE email_verification_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS ieum_trial_claims_marketing_idx ON ieum_trial_claims(marketing_consent,email_verified_at,country_code,created_at DESC);

CREATE TABLE IF NOT EXISTS ieum_trial_polls (
  id uuid PRIMARY KEY, question text NOT NULL, options jsonb NOT NULL,
  target_filter jsonb NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','closed')),
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), closes_at timestamptz
);
CREATE TABLE IF NOT EXISTS ieum_trial_poll_votes (
  poll_id uuid NOT NULL REFERENCES ieum_trial_polls(id), claim_id uuid NOT NULL REFERENCES ieum_trial_claims(id),
  option_index integer NOT NULL CHECK(option_index>=0), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(poll_id,claim_id)
);
