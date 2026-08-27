# IEUM Manager v1.0.0.8 — 상품권 인쇄·관리 화면 복구

## 해결한 문제

상품권 QR SVG 문자열 끝에는 줄바꿈이 있습니다. 이전 코드는 줄 끝 바로 앞의 `</svg>`만 제거하려 해 QR의 닫는 태그가 남았고, 바깥 상품권 SVG의 `<g>`보다 먼저 `</svg>`가 닫히는 잘못된 XML을 만들었습니다. 또한 같은 이미지 API가 인쇄 화면에서도 `Content-Disposition: attachment`로 응답해 Chrome의 `<img>` 표시를 방해했습니다.

v1.0.0.8은 QR 바깥 태그를 공백까지 포함해 제거하고 다음처럼 응답을 분리합니다.

- 인쇄 화면의 `<img>`: `inline`
- 관리자의 **앞면 SVG** 저장 링크: `download=1`, `attachment`
- 앞면 로딩 완료 전 인쇄 버튼 비활성화, 로딩 실패 시 명확한 안내

기존에 발행한 상품권도 DB 변경이나 재발행 없이 기존 인쇄 URL을 새로고침하면 정상 표시됩니다.

## 상품권 관리자 사용자 매뉴얼

관리 주소는 `https://iem.aah.name/admin/vouchers`입니다.

1. AAH 관리자 JWT로 로그인하거나 비상 관리자 토큰으로 인증합니다.
2. 상단 카드에서 누적 발행, 지급 완료, 미사용 준비금과 전체 건수를 확인합니다.
3. **상태**에서 미사용, 지급 처리 중, 지급 완료, 지급 실패, 취소, 만료를 선택합니다.
4. 상품권 번호를 입력해 검색합니다. 목록은 페이지당 10건입니다.
5. 지급 완료 항목은 **지급 거래 확인**으로 Explorer를 엽니다.
6. 미사용 항목만 **미사용 상품권 취소**가 가능합니다.
7. 처리 중/실패 항목은 기존 안전 복구 절차에 따라 **체인 상태 확인** 후 필요한 경우에만 **동일 거래 재전파**를 사용합니다.

교환번호는 해시로만 저장되어 과거 원문을 복원할 수 없습니다. 새 버전부터 현재 관리자 탭에서 발행한 상품권은 탭의 `sessionStorage`에 인쇄 정보가 남아 새로고침 후 **다시 인쇄/PDF**가 가능합니다. 탭을 닫거나 다른 PC를 사용하면 사라집니다. 보안을 위해 서버 DB나 장기 브라우저 저장소에는 교환번호를 추가 저장하지 않았습니다.

메인 Explorer의 좌측 **Admin** 메뉴는 `/api/session`에서 유효한 AAH 관리자 JWT가 확인된 경우에만 나타나며 `/admin/vouchers`로 연결됩니다. 비상 토큰 값이나 쿠키 존재 여부만으로 메뉴를 표시하지 않습니다.

## Docker 배포와 환경변수

DB 마이그레이션과 새 환경변수는 없습니다. 기존 값을 유지합니다.

```dotenv
POSTGRES_PASSWORD=실제_긴_비밀번호
IEUM_MANAGER_ADMIN_TOKEN=32자_이상의_관리자_토큰
JWT_SECRET=AAH와_동일한_JWT_SECRET
IEUM_VOUCHER_PRIVATE_KEY=0x로_시작하는_상품권_전용_지갑_개인키
IEUM_VOUCHER_PUBLIC_URL=https://iem.aah.name
IEUM_VOUCHER_RPC_URL=https://irpc.aah.name
IEUM_VOUCHER_EXPLORER_URL=https://iem.aah.name/tx/
IEUM_VOUCHER_CODE_PEPPER=32자_이상의_별도_무작위_비밀값
```

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

배포 후 기존 상품권 인쇄 URL을 새로고침하고, 앞면 준비 완료 문구가 나온 다음 PDF 미리보기를 확인합니다.

## 검증

```bash
npm ci
npm test
node --check server.js
node --check public/app.js
node --check public/voucher-print.js
node --check public/vouchers-admin.js
sudo docker compose config --quiet
sudo docker compose build manager indexer
```

## 버전·Git·PR·태그 절차

표시 버전은 `1.0.0.8`, 내부 SemVer는 `1.0.0-8`입니다.

```bash
node -p "require('./package.json').version"
git switch -c fix/v1.0.0.8-voucher-print-admin
git status --short
git add -- CHANGELOG.md README.md package.json package-lock.json server.js \
  public/admin.js public/app.js public/voucher-print.css public/voucher-print.html \
  public/voucher-print.js public/vouchers-admin.css public/vouchers-admin.html \
  public/vouchers-admin.js test/server.test.js test/voucher-print-admin.test.js \
  docs/VERSION_1.0.0.8_VOUCHER_PRINT_ADMIN.md
git commit -m "fix: restore voucher printing and improve admin"
git push -u origin fix/v1.0.0.8-voucher-print-admin
gh pr create --base main --head fix/v1.0.0.8-voucher-print-admin --draft \
  --title "IEUM Manager v1.0.0.8 상품권 인쇄·관리 복구" \
  --body "상품권 SVG 인쇄 오류를 고치고 상태·검색·페이징·세션 재출력과 JWT Admin 메뉴를 추가합니다."
```

PR 병합과 CI 성공 후 Manager 태그 정책을 사용하는 경우에만 태그를 생성합니다. 현재 운영 정책이 Manager 태그 제외라면 아래 단계는 생략합니다.

```bash
git switch main
git pull --ff-only origin main
git tag -a v1.0.0.8 -m "IEUM Manager v1.0.0.8"
git push origin v1.0.0.8
```
