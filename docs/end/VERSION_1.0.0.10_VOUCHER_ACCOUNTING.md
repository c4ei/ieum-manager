# IEUM Manager v1.0.0.10 — 상품권 발행·폐기 회계 지표

## 변경 이유

상품권을 폐기해도 `누적 발행`이 줄지 않는 동작은 과거 발행 기록을 보존하는 회계 기준에는 맞지만, 현재 유효한 상품권 금액을 바로 알기 어려웠습니다. v1.0.0.10은 총이력과 현재 책임 금액을 분리합니다.

## 화면 지표 정의

- **누적 발행**: 상태와 관계없이 과거 한 번이라도 발행된 상품권 총액
- **유효 발행**: 누적 발행에서 폐기·만료를 제외한 금액과 건수
- **지급 완료**: 실제 지갑으로 지급 완료된 상품권 금액
- **미사용 준비금**: `issued` 또는 `claiming` 상태로 지급을 위해 확보한 금액
- **폐기**: 운영자가 폐기한 상품권 금액과 건수
- **만료**: 만료된 상품권 금액과 건수

예를 들어 100 IEUM 상품권 3장을 폐기하고 0.1 IEUM 상품권 1장이 지급 완료됐다면 다음처럼 표시됩니다.

```text
누적 발행 300.1 IEUM
유효 발행 0.1 IEUM · 1건
지급 완료 0.1 IEUM
미사용 준비금 0 IEUM
폐기 300 IEUM · 3건
만료 0 IEUM · 0건
```

누적 발행을 낮추지 않는 이유는 과거 발행·폐기 이력을 숨기지 않기 위해서입니다. 현재 실제 유효 금액은 **유효 발행**을 기준으로 확인합니다.

## 배포

DB 마이그레이션과 새 환경변수는 없습니다. v1.0.0.9의 `IEUM_VOUCHER_ARCHIVE_KEY`를 포함한 기존 환경변수를 그대로 유지합니다.

```bash
cd ~/www/ieum-manager_8787
git switch main
git pull --ff-only origin main
sudo docker compose config --quiet
sudo docker compose build --no-cache manager indexer
sudo docker compose up -d --force-recreate manager indexer
sudo docker compose ps
sudo docker compose logs --tail=100 manager indexer
```

배포 후 `https://iem.aah.name/admin/vouchers`를 새로 열어 6개 지표를 확인합니다. HTML이 `v=10010` 자산을 요청하므로 이전 JavaScript·CSS가 혼합되지 않습니다.

상품권 인쇄 화면도 `v=10010` 스크립트를 사용합니다. 앞면 SVG가 브라우저 캐시에서 먼저 표시된 경우에는 이미지 완료 상태와 `decode()`를 추가 확인해 **앞면 준비 중…** 버튼을 **인쇄 또는 PDF 저장**으로 전환합니다.

## 검증

```bash
npm ci
npm test
node --check server.js
node --check public/vouchers-admin.js
sudo docker compose config --quiet
sudo docker compose build manager indexer
```

## Git·PR·태그 절차

표시 버전은 `1.0.0.10`, 내부 SemVer는 `1.0.0-10`입니다.

```bash
git switch -c fix/v1.0.0.10-voucher-accounting
git status --short
git add -- CHANGELOG.md README.md package.json package-lock.json server.js \
  public/admin.html public/index.html public/voucher-summary.css public/vouchers-admin.html \
  public/vouchers-admin.js test/server.test.js test/voucher-print-admin.test.js \
  docs/VERSION_1.0.0.10_VOUCHER_ACCOUNTING.md
git commit -m "fix: separate voucher lifecycle accounting totals"
git push -u origin fix/v1.0.0.10-voucher-accounting
gh pr create --base main --head fix/v1.0.0.10-voucher-accounting --draft \
  --title "IEUM Manager v1.0.0.10 상품권 회계 지표 분리" \
  --body "누적 발행과 유효 발행·폐기·만료 금액 및 건수를 분리합니다."
```

Manager 태그 제외 정책이면 태그는 생성하지 않습니다. 필요한 정책일 때만 PR 병합과 CI 성공 후 `v1.0.0.10` 태그를 생성합니다.
