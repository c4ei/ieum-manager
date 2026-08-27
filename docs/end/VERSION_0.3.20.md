# IEUM Manager v0.3.20 — SNS 최초 참여 보상 안정화

## 변경 사항

- `/rewards.html`에서 AAH 로그인 사용자가 지갑 주소, SNS 플랫폼·계정, 공개 게시물 URL을 입력해 신청한다.
- 보상 금액은 `0.01 IEUM`(`10000000000000000 wei`)으로 고정한다.
- AAH 계정, 지갑 주소, SNS 계정, 게시물 URL은 각각 상태와 관계없이 최초 1회만 허용한다.
- 자동검증 성공 시 `approved`, 불일치·미확인 시 `pending`, 검증 서버 장애·시간 초과 시에도 `pending`으로 저장한다.
- `IEUM_SNS_VERIFY_URL`은 고정 HTTPS 주소만 사용하며 선택적으로 `IEUM_SNS_VERIFY_TOKEN`을 Bearer 토큰으로 전달한다.
- 관리자 `/admin/rewards`에서 대기 신청을 승인·거절하고 검증 상태와 사유를 확인한다.

중요: 승인은 지급 대상을 확정하는 관리 상태다. 최대공급량을 합의에서 강제하는 발행 기능이
활성화되기 전에는 Manager가 자동으로 신규 IEUM을 발행하거나 개인키를 사용하지 않는다.

## 환경 설정

```dotenv
IEUM_SNS_VERIFY_URL=https://verify.example.com/ieum/sns
IEUM_SNS_VERIFY_TOKEN=replace-with-a-long-random-token
```

검증 서비스 요청과 성공 응답 예시:

```json
{"platform":"x","account":"ieum_user","postUrl":"https://x.com/ieum_user/status/1"}
```

```json
{"verified":true,"platformAccountId":"account-1","postId":"post-1"}
```

## 테스트

Node.js 20 이상에서 실행한다.

```bash
npm ci
npm test
docker compose config
docker compose build manager indexer
```

## dev 커밋과 푸시

```bash
git switch dev
git pull --ff-only origin dev
git status

git add CHANGELOG.md README.md package.json package-lock.json server.js \
  lib/reward-campaigns.js public/index.html public/styles.css \
  public/rewards.html public/rewards.js test/reward-campaigns.test.js \
  test/server.test.js docs/VERSION_0.3.20.md

git commit -m "fix: stabilize SNS reward claims v0.3.20"
git push origin dev
```

## PR과 main 머지

GitHub에서 base `main`, compare `dev`로 PR을 만들고 Actions가 모두 통과한 뒤 머지한다.

```bash
gh pr create --base main --head dev \
  --title "IEUM Manager v0.3.20 SNS reward stabilization" \
  --body "SNS 최초 1회 정책, 검증 장애 대기 처리와 사용자 신청 화면을 추가합니다."
```

머지 후 로컬 main을 갱신한다.

```bash
git switch main
git pull --ff-only origin main
npm ci
npm test
```

## 태그와 배포

서명용 GPG 개인키가 없으므로 서명 태그(`-s`) 대신 annotated tag(`-a`)를 사용한다.

```bash
test "$(node -p "require('./package.json').version")" = "0.3.20"
git tag -a v0.3.20 -m "IEUM Manager v0.3.20"
git push origin v0.3.20
```

운영 서버에서는 태그와 빌드 결과를 확인한 다음 컨테이너를 재생성한다.

```bash
docker compose config
docker compose build --no-cache manager indexer
docker compose up -d --force-recreate manager indexer
curl -fsS https://iem.aah.name/api/snapshot | grep -o '"managerVersion":"[^"]*"'
```

예상값은 `"managerVersion":"0.3.20"`이다.
