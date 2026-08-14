# v0.3.12 최종 작업·배포 인수인계

## 큰 이벤트와 핵심 변경

커뮤니티의 회원 가입·대화·모임은 `aah.name`을 사용합니다. Manager/이음마당은 길드 공개 순위, 보상·공급량, 온체인 결제 확인을 맡습니다. 길드는 최대 100명, 5레벨·5등급이며 길드장과 이음지기는 별개입니다. 생성비는 재단지갑으로 보낸 확정 1 IEUM이고 거래 해시는 재사용할 수 없습니다. 신고는 길드·길드원·이벤트를 대상으로 접수하며 포상은 검토 기록만 만들고 자동 송금하지 않습니다.

## 설치·DB·검증

```bash
git clone https://github.com/c4ei/ieum-manager.git
cd ieum-manager
npm ci
psql "$DATABASE_URL" -f db/init.sql
node --check server.js
npm test
```

## 배포

환경변수 `DATABASE_URL`, `JWT_SECRET`, RPC 설정을 운영 비밀 저장소에서 주입합니다. 재단 개인키는 넣지 않습니다. 스테이징에서 AAH 로그인 쿠키, 길드 목록, 결제 송신자·수신자·금액·확정 블록·중복 거래 거절, 신고 속도 제한을 시험합니다. 정적 파일과 서버를 배포한 뒤 `/api/health`, `/api/snapshot`, `/api/guilds`를 확인합니다. DB 스키마는 추가형이므로 앱을 이전 버전으로 되돌려도 기존 탐색기 테이블은 유지됩니다.

## GitHub PR과 승인

```bash
git switch -c feature/guilds-v0.3.12
git add db public server.js package.json package-lock.json docs
git commit -m "feat: add AAH guild registry and reporting foundation"
git push -u origin feature/guilds-v0.3.12
gh pr create --draft --title "IEUM Manager v0.3.12 길드" --body "DB 적용·결제 검증·보안 점검표를 포함합니다."
```

CI 통과 후 앱 담당자와 재단 회계 담당자의 승인을 모두 받고 병합합니다. 운영 반영 전 DB 백업과 롤백 담당자를 지정합니다. 다음 변경 때는 이 문서에 계속 덧붙이지 말고 새 버전 인수인계 파일을 만들고, 오래된 세부 문서는 큰 이벤트 단위로 묶어 색인만 남깁니다.

세부 정책은 `docs/VERSION_0.3.12.md`를 봅니다.
