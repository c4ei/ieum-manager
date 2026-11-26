-- 1.0.0.19: 출석 적립(IEUM Chain v6 잠긴 적립)과 사고 대응 요청 기록. 여러 번 실행해도 안전합니다.
-- 되돌리기: 두 테이블은 다른 테이블이 참조하지 않으므로 DROP TABLE로 지울 수 있습니다(기록은 사라짐).
CREATE TABLE IF NOT EXISTS ieum_accrual_checkins (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  address text NOT NULL CHECK(address ~ '^0x[0-9a-f]{40}$'),
  kst_date date NOT NULL,
  amount_wei numeric(78,0) NOT NULL CHECK(amount_wei>0),
  status text NOT NULL CHECK(status IN ('paying','sent','confirmed','uncertain')),
  payout_nonce bigint,
  payout_raw_tx text,
  payout_hash text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ieum_accrual_checkins_user_day_idx ON ieum_accrual_checkins(user_id,kst_date);
CREATE UNIQUE INDEX IF NOT EXISTS ieum_accrual_checkins_address_day_idx ON ieum_accrual_checkins(address,kst_date);
CREATE UNIQUE INDEX IF NOT EXISTS ieum_accrual_checkins_nonce_idx ON ieum_accrual_checkins(payout_nonce) WHERE payout_nonce IS NOT NULL;

CREATE TABLE IF NOT EXISTS ieum_incident_requests (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK(kind IN ('freeze','recover','unfreeze')),
  case_id text NOT NULL,
  event jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','applied','rejected')),
  requested_by text NOT NULL,
  result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ieum_incident_requests_created_idx ON ieum_incident_requests(created_at DESC);
