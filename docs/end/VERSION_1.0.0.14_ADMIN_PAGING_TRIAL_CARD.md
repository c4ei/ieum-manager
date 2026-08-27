# IEUM Manager 1.0.0.14 — 관리자 UI와 QR 체험 명함

## 변경 내용

- `/admin/dashboard`, `/admin/rpc`, `/admin/peers`, `/admin/rewards`, `/admin/waf`, `/admin/blocked`, `/admin/audit`, `/admin/vouchers`, `/admin/trial-campaigns`가 동일한 좌측 메뉴 이름·순서·활성 표시를 사용한다.
- 별도 HTML인 관리자 페이지도 서버가 공통 메뉴 CSS/JS를 자동 삽입하므로 메뉴가 누락되지 않는다.
- 공개 Explorer에서 관리자 JWT가 확인될 때 나타나는 `Admin` 링크는 `/admin/dashboard`로 이동한다.
- Dashboard의 보상 이벤트, 지급 내역, SNS 신청, 구매 신청, WAF 감사 이벤트를 목록별 10건으로 나누고 이전·다음·전체 건수를 표시한다.
- 체험 캠페인마다 `QR 포함 체험 명함 PNG 받기`를 제공한다. 파일명은 `IEUM_TRIAL_캠페인이름_캠페인ID.png`이다.
- QR은 `/trial/캠페인ID`로 연결되며 공개 홍보용이므로 교환번호나 서버 비밀정보를 포함하지 않는다.
- 수령 화면은 `지갑이 있어요`와 `지갑이 없어요`로 나뉘며, 지갑이 없는 사용자는 공식 Light/Normal Wallet 설치 후 주소를 입력한다.

## 사용자 매뉴얼

1. `/admin/trial-campaigns`에서 캠페인을 생성하거나 기존 캠페인을 연다.
2. `QR 포함 체험 명함 PNG 받기`를 눌러 이미지를 저장한다.
3. 이미지를 블로그·SNS·인쇄 명함에 게시한다.
4. 사용자는 QR을 촬영하고 지갑 보유 여부를 선택한다.
5. 지갑이 있으면 주소와 CAPTCHA를 확인해 지급을 신청한다.
6. 지갑이 없으면 공식 PC Wallet을 설치하고 받기 주소를 복사해 돌아온다.
7. 관리자는 캠페인 화면에서 예산·사용/예약·잔액·신청/지급 건수를 확인하고 필요하면 즉시 중지한다.

## DB·환경변수·Docker

- v1.0.0.13을 적용한 서버에는 새 DB 마이그레이션이 없다.
- 새 환경변수도 없다. `IEUM_TRIAL_FINGERPRINT_KEY`, `IEUM_TURNSTILE_SITE_KEY`, `IEUM_TURNSTILE_SECRET`은 v1.0.0.13 설정을 유지한다.
- `package.json`, `package-lock.json`, Compose 변수의 버전·의존성 정합성을 확인한다.

```bash
npm ci
npm test
sudo docker compose config --quiet
sudo docker compose build --no-cache manager
sudo docker compose up -d --force-recreate manager
```

## Git · PR · Tag

```bash
git switch -c feat/v1.0.0.14-admin-trial-card
git add -- CHANGELOG.md README.md package.json package-lock.json server.js public/app.js public/admin.html public/admin.js public/admin-nav.css public/admin-nav.js public/admin-pagination.js public/vouchers-admin.html public/trial-campaigns-admin.html public/trial-campaigns-admin.js public/trial-campaigns.css public/trial.html public/trial.js test/server.test.js test/admin-trial-card.test.js docs/VERSION_1.0.0.14_ADMIN_PAGING_TRIAL_CARD.md
git commit -m "feat: unify admin UI and add trial QR card"
git push -u origin feat/v1.0.0.14-admin-trial-card
```

PR의 CI가 통과하고 main에 병합된 뒤 `v1.0.0.14` 태그를 생성한다. 실제 Git 커밋·PR·태그는 이 변경분 파일 생성 과정에서 수행하지 않는다.
