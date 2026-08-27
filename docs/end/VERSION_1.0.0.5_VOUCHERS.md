# IEUM Manager v1.0.0.5 — 1회용 IEUM 상품권

## 추가 기능

- 관리자가 금액·수량·만료일을 지정해 상품권을 발행합니다.
- 상품권은 `7KMA-3R9Q-P2TX-N8WD` 형태의 4-4-4-4 교환번호와 수령 URL QR을 포함합니다.
- 앞면 QR과 뒷면 교환번호를 한 번에 인쇄하거나 PDF로 저장할 수 있습니다.
- QR 접속자는 친절한 안내에 따라 IEUM 주소와 교환번호를 입력하고 한 번만 수령합니다.
- 관리자 화면 `/admin/vouchers`에서 누적 발행액, 지급액, 미사용 준비금과 상태를 확인합니다.
- 체인 총발행량과 상품권 누적 발행액을 명확히 분리합니다.

## 안전 장치

- 개인키는 DB나 상품권 이미지에 저장하지 않고 `IEUM_VOUCHER_PRIVATE_KEY` 환경변수에서만 읽습니다.
- 교환번호 원문은 DB에 저장하지 않고 pepper가 적용된 SHA-256 해시만 저장합니다.
- 혼동되는 `0/O`, `1/I` 문자는 자동 생성에서 제외합니다.
- public ID와 QR token은 DB UNIQUE 제약으로 중복을 차단하며, 충돌 시 최대 5회 재생성합니다.
- 발행 전에 지급 지갑 잔액과 기존 미사용 상품권 준비금을 확인합니다.
- 수령 시 DB 행 잠금과 `issued → claiming → claimed` 상태 전이로 중복 지급을 차단합니다.
- 전송 실패는 `failed`로 고정하여 자동 재전송에 따른 이중 지급을 막고 관리자 확인 대상으로 남깁니다.

## 운영 적용

```bash
psql "$DATABASE_URL" -f db/migrate-1.0.0.5.sql
```

`.env`에 다음 값을 설정합니다.

```dotenv
IEUM_VOUCHER_PRIVATE_KEY=상품권_전용_지갑_개인키
IEUM_VOUCHER_PUBLIC_URL=https://iem.aah.name
IEUM_VOUCHER_RPC_URL=https://irpc.aah.name
IEUM_VOUCHER_EXPLORER_URL=https://iem.aah.name/tx/
IEUM_VOUCHER_CODE_PEPPER=32자_이상의_별도_무작위_비밀값
```

재단 주 지갑 개인키를 사용하지 말고, 필요한 수량만 넣은 별도 상품권 지급 지갑을 사용해야 합니다.

## 검증

`node --check server.js`와 `node --test`를 실행합니다.
