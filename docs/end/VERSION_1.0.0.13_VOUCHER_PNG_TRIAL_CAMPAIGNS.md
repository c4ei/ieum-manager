# IEUM Manager 1.0.0.13 — 상품권 PNG와 체험 명함 캠페인

## 사용자 기능

- 상품권 버튼명을 실제 용도가 드러나는 한국어로 정리했다.
- `교환번호 포함 PNG 받기`는 QR과 교환번호를 한 이미지에 넣고 `IEUM_금액_YYMMDD_A_상품권번호.png`로 저장한다.
- PNG는 소유자가 사용할 수 있는 무기명 상품권이므로 관리자 확인 뒤에만 복호화·생성하며 캐시하지 않는다.
- 체험 명함 캠페인은 이름, 1회 지급액, 최초 예산, 기간, IP/기기 일일 한도, 5분 대량요청 한도, 최소 대기시간, CAPTCHA를 관리한다.
- 관리자는 캠페인을 즉시 중지·재개하고 소진된 예산을 금액·사유와 함께 추가할 수 있다. 과거 지급·예산 추가 이력은 덮어쓰지 않는다.

## 안전 구조

- 주소는 캠페인당 한 번만 허용한다. IP와 기기 식별값은 원문 대신 HMAC-SHA256으로 저장한다.
- PostgreSQL 행 잠금으로 동시 신청에서도 총예산을 초과 예약하지 않는다.
- 상품권과 캠페인 지급은 같은 advisory lock과 nonce 예약 범위를 사용한다.
- 실패한 온체인 전송은 자동 재지급하지 않고 `failed`로 남겨 운영자가 예상 거래 해시를 확인하게 한다.
- CAPTCHA는 Cloudflare Turnstile을 사용한다. 사이트 키와 비밀키가 없는 상태에서 CAPTCHA 필수 캠페인을 운영하지 않는다.

## 배포

```bash
openssl rand -base64 48  # IEUM_TRIAL_FINGERPRINT_KEY 생성
sudo docker compose exec -T postgres psql -U "${POSTGRES_USER:-ieum}" -d "${POSTGRES_DB:-ieum_exp}" < db/migrate-1.0.0.13.sql
npm ci
npm test
sudo docker compose build --no-cache manager
sudo docker compose up -d --force-recreate manager
```

`.env`에 `IEUM_TRIAL_FINGERPRINT_KEY`, `IEUM_TURNSTILE_SITE_KEY`, `IEUM_TURNSTILE_SECRET`을 설정한다. 키는 Git에 커밋하지 않는다.

관리 화면은 `/admin/trial-campaigns`, 상품권 관리는 `/admin/vouchers`이다.


git switch main
git pull --ff-only origin main
git tag -a v1.0.0.13 -m "IEUM Manager v1.0.0.13"
git push origin v1.0.0.13
