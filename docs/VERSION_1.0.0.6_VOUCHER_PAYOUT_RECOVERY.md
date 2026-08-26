# IEUM Manager v1.0.0.6 — 상품권 지급 장애 복구

## 해결한 문제

v1.0.0.5는 IEUM 거래가 노드에 접수된 직후 DB 기록에 장애가 발생하면 지급 여부가 불명확해질 수 있었습니다. v1.0.0.6은 새 지급 거래를 만들기 전에 다음 값을 DB에 먼저 저장합니다.

- 지급 지갑 nonce (`payout_nonce`)
- 서명 완료 raw 거래 (`payout_raw_tx`)
- 서명 거래에서 계산한 예상 해시 (`payout_expected_hash`)

전송 결과가 불명확해도 새 nonce·새 거래를 만들지 않습니다. 관리자는 예상 해시를 체인에서 조회하거나 저장된 동일 raw 거래만 재전파합니다. 동일 raw 거래는 항상 동일 해시이므로 중복 지급을 만들지 않습니다.

## 상태와 관리자 사용자 매뉴얼

| 상태 | 의미 | 관리자 조치 |
|---|---|---|
| `issued` | 아직 수령 전 | 취소 가능 |
| `claiming` | 지급 거래 저장 또는 전파 중 | 먼저 **체인 상태 확인** |
| `claimed` | 거래 전파 및 DB 기록 완료 | 거래 링크 확인 |
| `failed` | v1.0.0.5 등 구버전 장애 기록 | 예상 해시가 있으면 체인 확인, 없으면 수동 조사 |

복구 순서:

1. `/admin/vouchers`에서 `claiming` 또는 `failed` 상품권을 찾습니다.
2. **체인 상태 확인**을 누릅니다.
3. 예상 해시가 체인에서 발견되면 Manager가 `claimed`로 복구합니다.
4. 발견되지 않으면 다른 운영 노드에서도 예상 해시를 확인합니다.
5. 거래가 없음을 확인한 뒤 **동일 거래 재전파**를 누릅니다.
6. 이 버튼은 DB에 저장된 raw 거래만 재전파하며 새 거래를 생성하지 않습니다.

예상 해시나 raw 거래가 없는 구버전 `failed` 행은 자동 재지급하지 마세요. 지급 지갑 nonce와 해당 수령 주소의 온체인 거래를 수동 확인해야 합니다.

## 기존 Docker 운영 DB 적용

`db/init.sql`은 새 PostgreSQL 볼륨에서만 자동 실행됩니다. 기존 볼륨에는 다음 마이그레이션을 한 번 적용합니다.

```bash
sudo docker compose exec -T postgres \
  psql -U "${POSTGRES_USER:-ieum}" -d "${POSTGRES_DB:-ieum_exp}" \
  < db/migrate-1.0.0.6.sql
```

그다음 이미지를 재빌드합니다.

```bash
sudo docker compose config
sudo docker compose build --no-cache manager indexer
sudo docker compose up -d --force-recreate manager indexer
sudo docker compose logs --tail=100 manager indexer
```

## Docker `.env` 필수 변수

```dotenv
POSTGRES_PASSWORD=실제_긴_비밀번호
IEUM_MANAGER_ADMIN_TOKEN=32자_이상의_관리자_토큰
JWT_SECRET=AAH와_동일한_JWT_SECRET
IEUM_VOUCHER_PRIVATE_KEY=0x로_시작하는_상품권_전용_지갑_개인키
IEUM_VOUCHER_PUBLIC_URL=https://iem.aah.name
IEUM_VOUCHER_RPC_URL=http://host.docker.internal:8989
IEUM_VOUCHER_EXPLORER_URL=https://iem.aah.name/tx/
IEUM_VOUCHER_CODE_PEPPER=32자_이상의_별도_무작위_비밀값
```

공개 RPC는 rate limit 또는 `eth_sendRawTransaction` 정책에 영향을 받을 수 있으므로 지급에는 내부 운영 RPC를 권장합니다. 재단 주 지갑 대신 잔액을 제한한 상품권 전용 지갑을 사용하세요.

값을 노출하지 않고 컨테이너 전달 여부를 확인합니다.

```bash
sudo docker compose exec manager node -e '
for (const name of ["IEUM_VOUCHER_PRIVATE_KEY","IEUM_VOUCHER_PUBLIC_URL","IEUM_VOUCHER_RPC_URL","IEUM_VOUCHER_EXPLORER_URL","IEUM_VOUCHER_CODE_PEPPER"])
  console.log(name, process.env[name] ? "설정됨" : "누락");
'
```

## CI 환경변수 규칙

`.github/workflows/ci.yml`의 다음 두 단계 모두 상품권 필수 placeholder 변수를 가져야 합니다.

- `Validate Docker Compose`
- `Build application images without starting PostgreSQL`

CI에는 실제 개인키나 운영 비밀값을 넣지 않습니다. Compose 보간 및 이미지 빌드만 수행하므로 가짜 placeholder를 사용합니다.

## 검증

```bash
npm ci
npm test
node --check server.js
node --check public/vouchers-admin.js
POSTGRES_PASSWORD=ci IEUM_MANAGER_ADMIN_TOKEN=ci-only-placeholder-32-characters-minimum \
JWT_SECRET=ci-only-jwt-secret IEUM_VOUCHER_PRIVATE_KEY=ci-only-private-key-placeholder \
IEUM_VOUCHER_RPC_URL=http://127.0.0.1:8989 \
IEUM_VOUCHER_CODE_PEPPER=ci-only-voucher-pepper-32-characters-minimum \
docker compose config
```

## Git·PR·태그 절차

```bash
git switch -c fix/v1.0.0.6-voucher-recovery
git status --short
git add -- .github/workflows/ci.yml CHANGELOG.md README.md package.json package-lock.json \
  db/init.sql db/migrate-1.0.0.6.sql docs/VERSION_1.0.0.6_VOUCHER_PAYOUT_RECOVERY.md \
  lib/vouchers.js server.js public/vouchers-admin.js \
  test/server.test.js test/voucher-deployment.test.js test/vouchers.test.js
git commit -m "fix: make voucher payouts recoverable in v1.0.0.6"
git push -u origin fix/v1.0.0.6-voucher-recovery
gh pr create --base main --head fix/v1.0.0.6-voucher-recovery --draft \
  --title "IEUM Manager v1.0.0.6 상품권 지급 복구" \
  --body "CI Docker 변수와 상품권 동일 거래 복구를 추가합니다."
```

PR 병합과 CI 성공 후 필요할 때만 Manager 태그를 생성합니다.

```bash
git switch main
git pull --ff-only origin main
git tag -a v1.0.0.6 -m "IEUM Manager v1.0.0.6"
git push origin v1.0.0.6
```
