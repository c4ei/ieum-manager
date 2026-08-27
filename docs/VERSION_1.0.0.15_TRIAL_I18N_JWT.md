# IEUM Manager 1.0.0.15 — QR 명함 다국어·한글 글꼴·JWT

## 수정 내용

- 이미지 엔진에 한글 글꼴이 없어 QR 명함 글자가 네모로 나오던 문제를 수정했다.
- Noto Sans KR TTF를 고정 의존성으로 설치하고 `opentype.js`로 모든 이미지 문자를 SVG path로 변환한다. Docker OS 글꼴 설치에 의존하지 않는다.
- 관리자에서 `한국어 QR 명함 PNG`와 `English QR Card PNG`를 각각 다운로드할 수 있다.
- 한국어 QR은 `?lang=ko`, 영어 QR은 `?lang=en` 수령 페이지로 연결된다.
- 체험 페이지의 지갑 보유 여부, 설치 안내, 보안 문구, 지급 상태를 한국어/영어로 전환한다.
- 정상 관리자 인증은 세션 인증이 아니라 AAH JWT 쿠키 인증이다. 서버는 요청마다 JWT 서명과 `userType === 'A'`를 검증하고 Dashboard에 인증 유형과 계정을 표시한다.
- `sessionStorage`는 비상 관리자 토큰을 임시 보관할 때만 사용한다.

## 사용자 매뉴얼

1. `/admin/trial-campaigns`에서 한국어 또는 영어 QR 명함 PNG를 받는다.
2. 대상 독자에 맞는 이미지를 블로그·SNS·인쇄물에 사용한다.
3. 사용자는 QR 접속 후 상단 `한국어 / English` 버튼으로 언어를 바꿀 수 있다.
4. 지갑이 있으면 주소를 입력하고, 없으면 공식 Wallet 설치 안내를 따른다.

## DB·환경변수·Docker

- DB 마이그레이션 없음.
- 새 환경변수 없음.
- 새 NPM 의존성: `@expo-google-fonts/noto-sans-kr`, `opentype.js`.

```bash
npm ci
npm test
sudo docker compose config --quiet
sudo docker compose build --no-cache manager
sudo docker compose up -d --force-recreate manager
```

## Git · PR · Tag

v1.0.0.14가 이미 main에 커밋·푸시되어 있으므로 이 변경분은 새 커밋으로 올린다.

```bash
git add -- CHANGELOG.md README.md package.json package-lock.json server.js public/admin.html public/admin.js public/trial-campaigns-admin.html public/trial-campaigns-admin.js public/trial-campaigns.css public/trial.html public/trial.js test/server.test.js test/trial-i18n-jwt.test.js docs/VERSION_1.0.0.15_TRIAL_I18N_JWT.md
git commit -m "fix: render multilingual trial cards and clarify JWT auth"
git push origin main
```

CI와 운영 확인 후 태그:

```bash
git tag -a v1.0.0.15 -m "IEUM Manager v1.0.0.15"
git push origin v1.0.0.15
```
