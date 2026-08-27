# IEUM Manager v0.3.18 — 관리자 전용 피어 상세

## 목적

공개 화면의 `연결 피어` 값은 네 메인 노드가 보고한 연결 수의 합계입니다. 같은 원격 노드가 여러 메인 노드에 연결되면 중복될 수 있습니다. v0.3.18은 관리자 화면에서 `Node ID` 기준 고유 피어를 별도로 확인하도록 개선합니다.

## 변경 사항

- AAH 관리자 JWT가 유효할 때만 공개 화면의 연결 피어 카드를 `/admin/peers` 링크로 활성화합니다.
- 피어 목록과 개별 상세 API는 기존 `adminAuthorized` 검사를 통과해야 응답합니다.
- `discovered_nodes`에서 설정된 메인 노드를 제외하고 외부 피어를 Node ID 기준으로 표시합니다.
- IP/포트, 국가, 노드·프로토콜 버전, 블록 높이, 연결 방향, 지연시간, 온라인 시간, 최근 관측, 수집 노드, 지갑, 잔액, capabilities, 상대 피어를 표시할 수 있습니다.
- RPC가 제공하지 않은 정보는 `미제공`으로 표시하며 국가나 지갑 주소를 추측하지 않습니다.
- 인덱서의 각 수집 주기 시작 시 과거 외부 피어를 오프라인으로 전환하고, 이번 주기에 다시 발견된 피어만 온라인으로 갱신합니다.
- 좌측 IEUM 로고를 클릭하거나 Enter/Space를 누르면 첫 페이지(`/`)로 이동합니다.

## 보안 경계

- HTML 파일 자체에는 민감한 피어 데이터가 포함되지 않습니다.
- `/api/admin/peers`와 `/api/admin/peers/:nodeId`는 AAH `token` JWT의 `userType=A` 또는 최소 32자의 비상 관리자 토큰이 필요합니다.
- IP, 지갑, 토폴로지는 관리자 API에서만 반환됩니다.
- 지갑은 Chain이 서명 검증 결과를 제공한 경우에만 `서명 검증`으로 표시합니다.
- 국가 정보는 GeoIP 또는 Chain RPC 지원 전에는 표시되지 않을 수 있습니다.

## 테스트

```bash
npm ci
npm test

POSTGRES_PASSWORD=ci-only-placeholder \
IEUM_MANAGER_ADMIN_TOKEN=ci-only-placeholder-32-characters-minimum \
JWT_SECRET=ci-only-jwt-secret-not-for-production \
docker compose config

POSTGRES_PASSWORD=ci-only-placeholder \
IEUM_MANAGER_ADMIN_TOKEN=ci-only-placeholder-32-characters-minimum \
JWT_SECRET=ci-only-jwt-secret-not-for-production \
docker compose build manager indexer
```

운영 적용 전에는 AAH 관리자 로그인 후 연결 피어 카드가 클릭되는지, 일반 사용자에게는 링크가 활성화되지 않는지, `/api/admin/peers` 직접 요청이 `401`인지 확인합니다.

## dev 푸시

이 저장소의 정식 브랜치는 `main`이며 `master` 브랜치는 없습니다. `main`이 일반적인 master 역할을 합니다.

```bash
git switch -c dev 2>/dev/null || git switch dev
git add CHANGELOG.md docs/VERSION_0.3.18.md package.json package-lock.json \
  server.js indexer.js lib/peers.js test/server.test.js \
  public/app.js public/admin.js public/admin.css public/admin-peers.js \
  public/i18n.js public/index.html public/peers.html public/styles.css
git commit -m "feat: add admin-only peer details"
git push -u origin dev
```

## dev → main PR

GitHub 웹에서 `base: main`, `compare: dev`로 PR을 만들거나 GitHub CLI를 사용합니다.

```bash
gh pr create \
  --base main \
  --head dev \
  --title "IEUM Manager v0.3.18 관리자 전용 피어 상세" \
  --body "관리자 전용 피어 목록·상세 API/UI, 오래된 피어 상태 정리, 로고 홈 링크를 추가합니다."
```

CI가 성공한 뒤 PR을 병합합니다. 보호 규칙이 있다면 GitHub 웹의 Merge 버튼을 사용합니다.

## main 병합 후 태그

```bash
git switch main
git pull --ff-only origin main
git tag -a v0.3.18 -m "IEUM Manager v0.3.18"
git push origin v0.3.18
```

GPG 서명 키가 설치된 환경에서만 `git tag -s`를 사용합니다. 서명 키가 없다면 위와 같이 annotated tag(`-a`)를 사용합니다.

## 운영 반영

```bash
docker compose config >/dev/null
docker compose build --no-cache manager indexer
docker compose up -d --force-recreate manager indexer
docker compose logs --tail=100 manager indexer
```

이번 배포에는 인덱서의 피어 온라인 상태 갱신 변경이 포함되므로 `manager`와 `indexer`를 함께 재빌드합니다.
