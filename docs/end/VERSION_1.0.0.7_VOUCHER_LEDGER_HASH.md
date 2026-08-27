# IEUM Manager v1.0.0.7 — 상품권 원장 해시·Docker 권한 복구

## 해결한 운영 이슈

IEUM Chain의 `eth_sendRawTransaction`은 Ethereum의 `keccak256(raw)`가 아니라 원장 합의 필드와 `ethraw:<hex>` 서명을 SHA-256으로 계산한 `Transaction::id()`를 반환합니다. v1.0.0.6은 두 값을 비교해 정상 지급 후에도 `claiming`으로 남을 수 있었습니다.

v1.0.0.7은 다음을 반영합니다.

1. 지급 전에 IEUM Chain과 동일한 원장 거래 ID를 계산합니다.
2. 노드 반환 해시와 원장 ID를 비교합니다.
3. v1.0.0.6에서 저장한 raw 거래의 보내는 주소·받는 주소·금액·nonce를 모두 검증한 뒤 기존 keccak 예상 해시를 원장 ID로 교정합니다.
4. 감사 로그 쓰기 실패는 stderr에 남기되 API와 Manager 프로세스를 종료하지 않습니다.
5. Docker 시작 스크립트가 `/app/data`, `/app/logs` named volume만 `ieum` 사용자 소유로 교정한 뒤 비권한 사용자로 실행합니다.

## 기존 `claiming` 상품권 복구 사용자 매뉴얼

1. 배포 및 재시작을 완료합니다.
2. `https://iem.aah.name/admin/vouchers`에 접속합니다.
3. `claiming` 상품권에서 **체인 상태 확인**을 누릅니다.
4. Manager가 저장된 raw 거래와 상품권 정보를 검증하고 IEUM 원장 해시로 자동 교정합니다.
5. 거래가 체인에 있으면 상태가 `claimed`로 바뀌고 실제 거래 링크가 표시됩니다.
6. 체인에서 발견되지 않을 때만 다른 운영 노드도 확인한 뒤 **동일 거래 재전파**를 사용합니다.

raw 거래가 없거나 주소·금액·nonce가 DB와 다르면 자동 복구하지 않습니다. 이 경우 수동 조사 없이 새 지급을 만들면 안 됩니다.

## Docker 배포

새 DB 컬럼이나 마이그레이션은 없습니다. v1.0.0.6 DB를 그대로 사용합니다.

```bash
cd ~/www/ieum-manager_8787
git switch main
git pull --ff-only origin main
sudo docker compose config --quiet
sudo docker compose build --no-cache manager indexer
sudo docker compose up -d --force-recreate manager indexer
sudo docker compose ps
sudo docker compose logs --tail=100 manager indexer
```

쓰기 권한 자동 교정을 확인합니다.

```bash
sudo docker compose exec -T manager sh -c \
  'id && touch /app/logs/.write-test && rm /app/logs/.write-test && echo 정상'
```

## Docker 환경변수 확인

추가된 환경변수는 없습니다. 다음 기존 변수를 유지합니다.

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

```bash
sudo docker compose exec manager node -e '
for (const name of ["IEUM_VOUCHER_PRIVATE_KEY","IEUM_VOUCHER_PUBLIC_URL","IEUM_VOUCHER_RPC_URL","IEUM_VOUCHER_EXPLORER_URL","IEUM_VOUCHER_CODE_PEPPER"])
  console.log(name, process.env[name] ? "설정됨" : "누락");
'
```

## 검증

```bash
npm ci
npm test
node --check server.js
node --check public/vouchers-admin.js
sudo docker compose config --quiet
sudo docker compose build manager indexer
```

## 버전·Git·PR·태그 확인

표시 버전은 `1.0.0.7`, 내부 SemVer는 `1.0.0-7`입니다.

```bash
node -p "require('./package.json').version"
git switch -c fix/v1.0.0.7-voucher-ledger-hash
git status --short
git add -- CHANGELOG.md README.md Dockerfile docker-entrypoint.sh package.json package-lock.json \
  docs/VERSION_1.0.0.7_VOUCHER_LEDGER_HASH.md lib/admin-policy.js lib/vouchers.js server.js \
  test/admin-audit.test.js test/server.test.js test/voucher-deployment.test.js test/vouchers.test.js
git commit -m "fix: align voucher recovery with IEUM ledger hash"
git push -u origin fix/v1.0.0.7-voucher-ledger-hash
gh pr create --base main --head fix/v1.0.0.7-voucher-ledger-hash --draft \
  --title "IEUM Manager v1.0.0.7 상품권 원장 해시 복구" \
  --body "상품권 원장 해시, 기존 claiming 복구와 Docker 로그 권한을 수정합니다."
```

PR 병합과 CI 성공 후 Manager 태그 정책을 사용하는 경우에만 생성합니다.

```bash
git switch main
git pull --ff-only origin main
git tag -a v1.0.0.7 -m "IEUM Manager v1.0.0.7"
git push origin v1.0.0.7
```
