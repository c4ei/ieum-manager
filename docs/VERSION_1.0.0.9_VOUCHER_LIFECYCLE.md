# IEUM Manager v1.0.0.9 — 상품권 보기·재출력·폐기 관리

## 운영 결과

Manager만 변경합니다. IEUM Chain, Wallet, Cold Wallet의 프로토콜이나 버전 변경은 없습니다.

새로 발행하는 상품권은 교환번호와 QR 수령 토큰을 평문으로 DB에 저장하지 않고, 별도의 `IEUM_VOUCHER_ARCHIVE_KEY`에서 파생한 키로 AES-256-GCM 인증 암호화합니다. 목록 API는 암호문도 반환하지 않고 `can_reprint` 여부만 반환합니다.

관리자가 **보기·재출력**을 누르면 다음 절차를 거칩니다.

1. AAH 관리자 JWT 또는 비상 관리자 토큰을 서버가 확인합니다.
2. 화면에서 비밀정보 표시 여부를 한 번 더 확인합니다.
3. 서버가 해당 한 건만 복호화합니다.
4. 교환번호, 앞·뒷면 인쇄/PDF, 앞면 SVG와 수령 화면 링크를 표시합니다.
5. DB에 조회 횟수·최근 조회 시각을 기록하고 감사 로그에 관리자·IP·상품권 번호를 남깁니다.
6. **숨기기**를 누르면 현재 화면에서 비밀정보를 제거합니다.

이미 v1.0.0.8 이전에 발행된 상품권에는 암호문이 없으므로 자동 복원할 수 없습니다. 원래 인쇄 URL·SVG·교환번호가 없고 미사용 상태라면 폐기 후 새로 발행합니다.

## 폐기 사용자 매뉴얼

1. `https://iem.aah.name/admin/vouchers`에 접속합니다.
2. 상태를 **미사용**으로 선택합니다.
3. 상품권 번호와 금액을 확인합니다.
4. **미사용 상품권 폐기**를 누릅니다.
5. 되돌릴 수 없다는 확인 후 폐기 사유를 2자 이상 입력합니다.
6. 상태가 **폐기**로 변경되고 폐기 시각·관리자·사유가 표시되는지 확인합니다.

`issued`만 폐기할 수 있습니다. `claiming`은 체인 상태 확인을 먼저 수행하고, `claimed`는 이미 지급됐으므로 폐기할 수 없습니다. 폐기된 상품권은 준비금 예약 합계에서 제외되며 같은 상품권을 다시 활성화하지 않습니다.

## 필수 암호화 키 생성·보관

다른 비밀번호·Pepper·개인키를 재사용하지 마세요.

```bash
openssl rand -base64 48
```

출력값을 운영 `.env`에 한 줄로 저장합니다.

```dotenv
IEUM_VOUCHER_ARCHIVE_KEY=생성한_32자_이상의_별도_무작위_값
```

이 키가 유출되면 DB를 가진 공격자가 상품권 비밀정보를 복호화할 수 있고, 키를 잃으면 운영자도 재출력할 수 없습니다. `.env`와 별도로 접근이 제한된 암호 관리자 또는 오프라인 백업에 보관하고 GitHub·로그·문서·메신저에 실제 값을 올리지 마세요. 키를 임의로 변경하면 기존 암호문을 읽을 수 없으므로 키 회전은 별도 재암호화 절차 없이는 수행하지 않습니다.

## DB 마이그레이션과 Docker 배포

먼저 DB를 백업하고 v1.0.0.9 파일을 적용한 뒤 마이그레이션을 한 번 실행합니다.

```bash
cd ~/www/ieum-manager_8787

sudo docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-ieum}" "${POSTGRES_DB:-ieum_exp}" \
  > "ieum-manager-before-v1.0.0.9-$(date +%Y%m%d-%H%M%S).sql"

sudo docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-ieum}" -d "${POSTGRES_DB:-ieum_exp}" \
  < db/migrate-1.0.0.9.sql

sudo docker compose config --quiet
sudo docker compose build --no-cache manager indexer
sudo docker compose up -d --force-recreate manager indexer
sudo docker compose ps
sudo docker compose logs --tail=100 manager indexer
```

마이그레이션은 `ADD COLUMN IF NOT EXISTS`를 사용해 동일 파일을 실수로 다시 실행해도 컬럼을 중복 생성하지 않습니다.

## Docker 환경변수 확인

`IEUM_VOUCHER_ARCHIVE_KEY` 한 개가 새로 추가됐습니다. 전체 상품권 변수는 다음과 같습니다.

```dotenv
IEUM_VOUCHER_PRIVATE_KEY=0x로_시작하는_상품권_전용_지갑_개인키
IEUM_VOUCHER_PUBLIC_URL=https://iem.aah.name
IEUM_VOUCHER_RPC_URL=https://irpc.aah.name
IEUM_VOUCHER_EXPLORER_URL=https://iem.aah.name/tx/
IEUM_VOUCHER_CODE_PEPPER=32자_이상의_별도_무작위_비밀값
IEUM_VOUCHER_ARCHIVE_KEY=32자_이상의_재출력용_별도_무작위_암호화키
```

값 자체를 출력하지 않고 설정 여부와 길이만 확인합니다.

```bash
sudo docker compose exec -T manager node -e '
for (const name of ["IEUM_VOUCHER_PRIVATE_KEY","IEUM_VOUCHER_PUBLIC_URL","IEUM_VOUCHER_RPC_URL","IEUM_VOUCHER_EXPLORER_URL","IEUM_VOUCHER_CODE_PEPPER","IEUM_VOUCHER_ARCHIVE_KEY"])
  console.log(name, process.env[name] ? `설정됨(${process.env[name].length})` : "누락");
'
```

## 배포 후 확인

1. `/admin.html?v=10009`에서 좌측 **상품권 관리** 메뉴를 확인합니다.
2. `/admin/vouchers`에서 새 상품권 한 장을 소액으로 발행합니다.
3. 새로고침 후 해당 상품권에 **보기·재출력**이 표시되는지 확인합니다.
4. 버튼을 눌러 교환번호와 인쇄/PDF 링크가 열리는지 확인하고 **숨기기**를 누릅니다.
5. 조회 횟수가 증가하는지 확인합니다.
6. 별도의 소액 상품권을 발행해 사유를 입력하고 폐기합니다.
7. 폐기 상태·시각·관리자·사유를 확인합니다.
8. 기존 상품권에는 **과거 상품권 · 재출력 정보 없음**이 표시되는지 확인합니다.

## 검증

```bash
npm ci
npm test
node --check server.js
node --check public/vouchers-admin.js
sudo docker compose config --quiet
sudo docker compose build manager indexer
```

## Git·PR·태그 절차

표시 버전은 `1.0.0.9`, 내부 SemVer는 `1.0.0-9`입니다.

```bash
git switch -c feature/v1.0.0.9-voucher-lifecycle
git status --short
git add -- .env.example .github/workflows/ci.yml CHANGELOG.md README.md \
  package.json package-lock.json docker-compose.yml server.js db/init.sql \
  db/migrate-1.0.0.9.sql lib/voucher-archive.js public/admin.html public/index.html \
  public/voucher-secret.css public/vouchers-admin.css public/vouchers-admin.html \
  public/vouchers-admin.js test/server.test.js test/voucher-archive.test.js \
  test/voucher-deployment.test.js test/voucher-print-admin.test.js \
  docs/VERSION_1.0.0.9_VOUCHER_LIFECYCLE.md
git commit -m "feat: manage encrypted voucher reprints and disposal"
git push -u origin feature/v1.0.0.9-voucher-lifecycle
gh pr create --base main --head feature/v1.0.0.9-voucher-lifecycle --draft \
  --title "IEUM Manager v1.0.0.9 상품권 생명주기 관리" \
  --body "상품권 암호화 재출력, 폐기 이력, 감사 기록과 캐시 방지를 추가합니다."
```

Manager 태그 제외 정책이면 태그는 생성하지 않습니다. 정책상 태그가 필요한 경우에만 PR 병합과 CI 성공 후 `v1.0.0.9`를 생성합니다.
