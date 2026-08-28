# IEUM Manager 1.0.0.17 — 체험 링크 메타데이터·CI·JWT 검증

## 변경 내용

- GitHub Actions의 `docker compose config`와 이미지 빌드 단계에 `IEUM_TRIAL_FINGERPRINT_KEY` CI 전용 placeholder를 추가했다.
- `/trial/{캠페인ID}` HTML에 캠페인 이름과 지급량을 반영한 제목·설명을 서버에서 생성한다.
- 카카오톡·SNS 미리보기용 Open Graph와 Twitter Card를 추가했다.
- 검색엔진과 AI가 페이지 의미를 파악할 수 있도록 canonical URL과 Schema.org JSON-LD를 추가했다.
- 캠페인별 1200×630 PNG를 공유 미리보기 이미지로 사용한다.
- 존재하지 않는 캠페인 주소는 `noindex,nofollow`로 처리한다.
- AAH JWT 검증을 재사용 가능한 모듈로 분리하고 실제 서명, 관리자 권한, 만료, 잘못된 비밀키와 손상 토큰을 테스트한다.

## 사용자 안내

체험 링크를 카카오톡·SNS 등에 붙여 넣으면 캠페인 이름, 지급 IEUM 수량, 안내 문구와 체험 명함 이미지가 미리보기로 표시된다. 서비스별 캐시에 이전 미리보기가 남아 있으면 새 URL로 한 번 공유하거나 해당 서비스의 공유 디버거에서 캐시를 갱신한다.

체험 참여 절차는 기존과 같다.

1. 체험 링크를 연다.
2. IEUM Wallet 보유 여부를 선택한다.
3. 사람 확인을 완료한다.
4. 본인이 관리하는 `0x...` 지갑 주소를 입력한다.
5. 지급 후 Explorer 거래 링크를 확인한다.

비밀번호, 복구 문구와 개인키는 체험 페이지에 입력하지 않는다.

## 관리자 JWT 확인

- AAH 로그인 쿠키 `token`은 Manager가 AAH와 동일한 `JWT_SECRET`으로 검증한다.
- JWT의 `userType`이 `A`인 관리자만 관리자 API에 자동 인증된다.
- 정상 인증 시 Dashboard에 `AAH 관리자 JWT 인증됨 · 이메일`이 표시된다.
- 일반 사용자 JWT, 만료 토큰, 다른 비밀키로 서명된 토큰과 손상 토큰은 거부된다.
- 비상용 `IEUM_MANAGER_ADMIN_TOKEN`은 JWT 장애 시에만 별도로 사용한다.

## Docker·환경변수

새 운영 환경변수는 없다. `IEUM_TRIAL_FINGERPRINT_KEY`는 v1.0.0.13부터 운영에서 사용 중이며, 이번 변경은 CI 누락만 보완한다. 운영 `.env`에서 다음 항목을 확인한다.

```dotenv
POSTGRES_PASSWORD=긴_무작위_비밀번호
IEUM_MANAGER_ADMIN_TOKEN=32자_이상_비상관리자토큰
JWT_SECRET=AAH와_완전히_동일한_JWT_SECRET
IEUM_VOUCHER_PRIVATE_KEY=상품권_전용_지갑_개인키
IEUM_VOUCHER_RPC_URL=https://irpc.aah.name
IEUM_VOUCHER_CODE_PEPPER=32자_이상_별도_키
IEUM_VOUCHER_ARCHIVE_KEY=32자_이상_별도_키
IEUM_TRIAL_FINGERPRINT_KEY=32자_이상_별도_키
IEUM_TURNSTILE_SITE_KEY=Cloudflare_Sitekey
IEUM_TURNSTILE_SECRET=Cloudflare_Secret_key
```

세 비밀값 `IEUM_VOUCHER_CODE_PEPPER`, `IEUM_VOUCHER_ARCHIVE_KEY`, `IEUM_TRIAL_FINGERPRINT_KEY`는 서로 다른 값을 사용한다. 값을 출력하지 않고 설정 여부와 길이만 확인한다.

```bash
sudo docker compose exec -T manager node -e '
for (const name of ["JWT_SECRET","IEUM_VOUCHER_CODE_PEPPER","IEUM_VOUCHER_ARCHIVE_KEY","IEUM_TRIAL_FINGERPRINT_KEY"]) {
  const value=process.env[name]||"";
  console.log(name+"="+(value.length>=32?"설정됨(32자 이상)":"누락 또는 짧음"));
}'
```

## 검증·배포

```bash
npm ci
npm test
sudo docker compose config --quiet
sudo docker compose build manager indexer
sudo docker compose up -d --force-recreate manager indexer
curl -fsS https://iem.aah.name/api/snapshot | grep -o '"managerVersion":"[^"]*"'
```

예상 Manager 버전은 `1.0.0.17`이다. 체험 링크 HTML도 확인한다.

```bash
curl -fsS https://iem.aah.name/trial/B3DBDDE1F6BE | grep -E 'og:title|og:image|canonical|application/ld\\+json'
```

## GitHub 커밋·PR·태그

```bash
git checkout -b release/manager-v1.0.0.17
git add -- .github/workflows/ci.yml CHANGELOG.md README.md package.json package-lock.json server.js lib/admin-auth.js test/admin-auth.test.js test/server.test.js test/trial-campaign.test.js test/voucher-deployment.test.js docs/VERSION_1.0.0.17_TRIAL_METADATA_CI_JWT.md
git commit -m "release: IEUM Manager v1.0.0.17"
git push -u origin release/manager-v1.0.0.17
gh pr create --base main --head release/manager-v1.0.0.17 --title "IEUM Manager v1.0.0.17" --body-file docs/VERSION_1.0.0.17_TRIAL_METADATA_CI_JWT.md
```

PR CI가 모두 통과하고 main에 병합된 뒤 태그를 만든다.

```bash
git checkout main
git pull --ff-only origin main
git tag -a v1.0.0.17 -m "IEUM Manager v1.0.0.17"
git push origin v1.0.0.17
```

## 이후 모든 Manager 버전업 체크리스트

1. `package.json`, `package-lock.json`, 표시 버전 테스트와 README 버전을 함께 갱신한다.
2. `CHANGELOG.md`와 `docs/VERSION_<버전>_<주제>.md`에 변경 내용, 사용자 안내, 운영 확인과 롤백 주의점을 기록한다.
3. 새 환경변수 또는 필수 변수 변경 시 `.env.example`, `docker-compose.yml`, 두 GitHub Actions Docker 단계와 관련 테스트를 동시에 갱신한다.
4. `npm test`, `docker compose config`, Manager/Indexer 이미지 빌드를 확인한다.
5. 실제 운영 배포 후 `/api/snapshot`의 Manager·Chain 버전과 주요 화면을 확인한다.
6. 기능 브랜치 커밋 → PR → CI 통과 → main 병합 → 주석 태그 순서를 지킨다.
7. 변경된 파일만 묶은 배포 압축본에는 상대 경로를 유지하고 비밀값과 `.env`를 넣지 않는다.
