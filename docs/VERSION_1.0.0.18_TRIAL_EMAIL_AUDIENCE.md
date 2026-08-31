# IEUM Manager 1.0.0.18 — 체험 이메일 인증·고객 타기팅·설문

## 사용자 동작

`/trial/{캠페인ID}`에서 지갑 주소와 이메일을 입력하고 필수 개인정보 수집·이용에 동의한다. 마케팅 이메일 동의는 선택이며 동의하지 않아도 0.01 IEUM 체험 신청이 가능하다. 신청 뒤 확인 메일의 링크를 열고 확인 버튼을 눌러야 지급된다. 링크를 여는 것만으로는 지급되지 않아 이메일 보안 프로그램의 자동 방문을 방어한다.

수집 항목은 이메일, 지갑 주소, 원 IP, IP 기반 국가 코드, 기기 식별값의 HMAC, 동의·인증·지급 시각이다. 국가 코드는 Cloudflare가 전달하는 `CF-IPCountry`를 사용하며 `IEUM_MANAGER_TRUST_PROXY=1`인 신뢰 프록시 구성에서만 저장한다. VPN·회사망·이동통신망 때문에 실제 거주 국가와 다를 수 있다.

## 관리자 안내

`/admin/trial-audience`는 관리자 JWT 또는 비상 토큰으로만 접근한다. 이메일 인증 여부, 마케팅 동의, 국가, 이메일·지갑 검색으로 대상을 좁히고 관심 태그를 저장할 수 있다. 설문은 마케팅 동의자를 기본 대상으로 하는 초안만 만든다. 실제 메일 발송은 이번 버전에 포함하지 않으며, 발송 전 수신 대상·목적·빈도와 수신 거부 경로를 별도 검토한다.

IP와 이메일은 개인정보다. 공개 화면·공개 API·감사 로그에 원문을 남기지 않는다. 운영자는 개인정보 처리방침에 목적, 항목, 보유기간, 파기, 위탁 SMTP 사업자를 명시하고 내부 보존기간을 정해야 한다. 관리자 화면의 검색 결과를 무단 다운로드하거나 마케팅 미동의자에게 홍보하지 않는다.

## DB 마이그레이션

배포 전 백업 후 순방향 마이그레이션을 한 번 적용한다. 재실행 가능하다.

```bash
sudo docker compose exec -T postgres psql -U "${POSTGRES_USER:-ieum}" -d "${POSTGRES_DB:-ieum_exp}" < db/migrate-1.0.0.18.sql
```

롤백은 새 컬럼을 즉시 삭제하지 않는다. 앱을 이전 버전으로 되돌리면 추가 컬럼과 테이블은 사용되지 않으며 데이터를 보존한다. 개인정보 파기는 운영 정책에 따라 별도 승인된 SQL로 수행한다.

## Docker 환경변수

```dotenv
NODEMAILER_USER=
NODEMAILER_PASS=
ADMIN_NOTIFY_EMAIL=
IEUM_TRIAL_EMAIL_VERIFICATION_MINUTES=1440
```

AAH에서 사용하는 Gmail Nodemailer 계정을 그대로 재사용한다. `NODEMAILER_USER`는 발신 주소, `NODEMAILER_PASS`는 Gmail 앱 비밀번호이며 `ADMIN_NOTIFY_EMAIL`은 회신 받을 관리자 주소다. 비밀번호는 저장소에 넣지 않는다. Gmail 계정의 2단계 인증·앱 비밀번호와 SPF, DKIM, DMARC를 확인한다.

이메일은 브라우저의 `type=email` 검사와 서버의 정규화·형식 검사를 모두 통과해야 한다. 형식만 올바른 가짜 주소는 확인 메일의 버튼을 누를 수 없으므로 지급되지 않는다.

## 검증·배포

```bash
npm ci
npm test
sudo docker compose config --quiet
sudo docker compose build manager indexer
sudo docker compose up -d --force-recreate manager indexer
curl -fsS https://iem.aah.name/api/snapshot | grep -o '"managerVersion":"[^"]*"'
```

실제 배포에서는 테스트 이메일로 신청 → 메일 수신 → 버튼 확인 → Explorer 지급 거래를 확인한다. 관리자 화면에서 이메일, IP, 국가, 인증 시각과 선택 동의가 정확한지 확인하되 운영 값을 로그에 출력하지 않는다.

## GitHub 커밋·PR·태그

```bash
git checkout -b feature/trial-email-audience
git add -- .github/workflows/ci.yml .env.example CHANGELOG.md README.md package.json package-lock.json docker-compose.yml server.js lib/trial-email.js db/init.sql db/migrate-1.0.0.18.sql public/admin-nav.js public/trial.html public/trial.js public/trial-verify.html public/trial-verify.js public/trial-audience-admin.html public/trial-audience-admin.js test/server.test.js test/trial-email-audience.test.js docs/VERSION_1.0.0.18_TRIAL_EMAIL_AUDIENCE.md APPLY_CHANGED_FILES.md
git commit -m "release: IEUM Manager v1.0.0.18 trial email audience"
git push -u origin feature/trial-email-audience
gh pr create --draft --base main --head feature/trial-email-audience --title "IEUM Manager v1.0.0.18" --body-file docs/VERSION_1.0.0.18_TRIAL_EMAIL_AUDIENCE.md
```

CI와 운영 전 수동 검증 후 PR을 병합하고 `main` CI 성공 뒤에만 태그를 만든다.

```bash
git checkout main
git pull --ff-only origin main
git tag -a v1.0.0.18 -m "IEUM Manager v1.0.0.18"
git push origin v1.0.0.18
```
