# IEUM Manager 1.0.0.16 — CAPTCHA와 체크박스 UI

## 변경 내용

- 지갑 확인 체크박스를 문장 위 가운데가 아니라 왼쪽에 정렬한다.
- 주소 입력 아래에 `사람 확인(CAPTCHA)` 카드가 항상 보인다.
- Turnstile 상태를 로딩, 완료, 만료, 키 미설정, 광고 차단·네트워크 실패로 구분한다.
- Cloudflare가 전달한 오류 코드를 한국어·영어 원인 안내와 함께 표시한다.
- 보완 배포의 정적 파일 캐시 키를 `10016r4`로 변경하고, Turnstile 렌더링 예외 메시지도 숨기지 않고 표시한다.
- Manager의 Content-Security-Policy에서 `challenges.cloudflare.com`의 스크립트, 연결, challenge iframe을 허용한다.
- 사람 확인이 필요한 캠페인은 Turnstile 완료 전 지급 버튼을 비활성화한다.
- 미완료 상태에서 제출을 시도하면 CAPTCHA 카드로 이동하고 해야 할 일을 안내한다.
- 한국어와 영어 문구를 모두 제공한다.

## 사용자 매뉴얼

정상 상태에서는 받을 주소 아래의 Cloudflare 사람 확인 영역이 자동으로 나타난다. Managed 모드는 상황에 따라 체크박스를 누르게 하거나 자동으로 통과시킨다. 초록색 `사람 확인이 완료되었습니다`가 나온 뒤 지갑 소유 확인 체크박스를 선택하고 지급 버튼을 누른다.

위젯이 나타나지 않으면 화면에 원인이 표시된다. 광고 차단 확장 기능을 잠시 끄고 `다시 불러오기`를 누른다. `Turnstile 키 설정` 메시지는 운영 설정 문제이므로 사용자가 해결할 수 없다.

오류 코드별 운영 확인:

- `110200`: Turnstile 위젯의 Hostname Management에 `iem.aah.name` 추가
- `110100`, `110110`, `400020`: `.env`의 SITE_KEY와 Cloudflare 위젯 사이트 키 일치 여부 확인
- `400070`: Cloudflare에서 위젯이 비활성화되었는지 확인
- `200500`: 광고 차단, 브라우저 보호 설정, CSP 또는 네트워크의 iframe 차단 확인

## 운영 확인

Cloudflare Turnstile 위젯의 허용 호스트명은 `iem.aah.name`이어야 한다. `https://`와 `/trial/...` 경로는 넣지 않는다. `.env`에는 동일한 위젯에서 발급한 실제 사이트 키와 비밀 키를 넣는다. 두 값은 `openssl rand`로 만드는 임의 키가 아니다.

```dotenv
IEUM_TURNSTILE_SITE_KEY=Cloudflare_Sitekey
IEUM_TURNSTILE_SECRET=Cloudflare_Secret_key
```

컨테이너에서 값의 존재 여부만 확인하며 실제 비밀값은 출력하지 않는다.

```bash
sudo docker compose exec -T manager node -e '
for (const name of ["IEUM_TURNSTILE_SITE_KEY","IEUM_TURNSTILE_SECRET"]) {
  console.log(name + "=" + (process.env[name] ? "설정됨" : "누락"));
}'
```

## DB·환경변수·Docker

- DB 마이그레이션 없음.
- 새 환경변수 없음. v1.0.0.13부터 사용한 Turnstile 키를 유지한다.

```bash
npm ci
npm test
sudo docker compose config --quiet
sudo docker compose build --no-cache manager
sudo docker compose up -d --force-recreate manager
```

## Git · Tag

```bash
git add -- CHANGELOG.md README.md package.json package-lock.json public/trial.html public/trial.js public/trial-campaigns.css test/server.test.js test/trial-captcha-ux.test.js test/voucher-print-admin.test.js docs/VERSION_1.0.0.16_CAPTCHA_UX.md
git commit -m "fix: clarify trial captcha and checkbox UX"
git push origin main
git tag -a v1.0.0.16 -m "IEUM Manager v1.0.0.16"
git push origin v1.0.0.16
```
