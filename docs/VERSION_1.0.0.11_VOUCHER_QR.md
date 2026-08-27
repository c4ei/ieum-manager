# IEUM Manager v1.0.0.11 — 상품권 QR 카메라 인식 개선

## 원인과 수정

QR 라이브러리가 만든 SVG는 모듈 좌표를 실제 크기로 확대하는 `viewBox`를 포함합니다. 기존 앞면 생성 코드는 QR의 바깥 `<svg>`를 제거하고 경로만 `<g>`에 넣어, 260px로 요청한 QR이 실제 모듈 좌표 크기인 약 60px로 표시됐습니다.

v1.0.0.11은 QR의 SVG와 `viewBox`를 그대로 유지하고 다음 크기로 배치합니다.

- QR 표시 영역: 300×300px
- 흰색 인식 배경: 320×320px
- Quiet zone: 2모듈
- 오류 정정 수준: M

상품권 전체 크기 1200×630px에서 QR이 충분히 크게 보이고, 휴대전화 카메라가 흰색 경계와 세 모서리 위치 패턴을 안정적으로 인식할 수 있습니다.

## 사용자 확인

1. `https://iem.aah.name/admin/vouchers`에서 v1.0.0.9 이후 상품권의 **보기·재출력**을 누릅니다.
2. **앞·뒷면 인쇄/PDF** 또는 **앞면 SVG**를 엽니다.
3. QR이 앞면 오른쪽에 약 300px 정사각형으로 표시되는지 확인합니다.
4. 모니터에서 휴대전화 기본 카메라로 먼저 스캔합니다.
5. PDF를 실제 크기 또는 100% 배율로 인쇄하고 종이에서도 스캔합니다.

동일 URL에서 SVG를 동적으로 다시 생성하므로 과거에 발행한 상품권도 원래 URL이나 암호화 재출력 정보가 있으면 확대된 QR로 다시 출력할 수 있습니다. 이미 내려받은 구형 SVG 파일은 다시 다운로드해야 합니다.

## 배포

DB 마이그레이션과 새 환경변수는 없습니다. v1.0.0.9 환경변수를 그대로 유지합니다.

```bash
cd ~/www/ieum-manager_8787
sudo docker compose config --quiet
sudo docker compose build --no-cache manager indexer
sudo docker compose up -d --force-recreate manager indexer
sudo docker compose ps
sudo docker compose logs --tail=100 manager indexer
```

## 검증

```bash
npm ci
npm test
node --check server.js
node --check public/voucher-print.js
sudo docker compose config --quiet
sudo docker compose build manager indexer
```

## Git·PR·태그 절차

표시 버전은 `1.0.0.11`, 내부 SemVer는 `1.0.0-11`입니다.

```bash
git switch -c fix/v1.0.0.11-voucher-qr
git status --short
git add -- CHANGELOG.md README.md package.json package-lock.json server.js \
  public/admin.html public/index.html public/voucher-print.html public/vouchers-admin.html \
  test/server.test.js test/voucher-print-admin.test.js \
  docs/VERSION_1.0.0.11_VOUCHER_QR.md
git commit -m "fix: enlarge voucher QR for camera scanning"
git push -u origin fix/v1.0.0.11-voucher-qr
gh pr create --base main --head fix/v1.0.0.11-voucher-qr --draft \
  --title "IEUM Manager v1.0.0.11 상품권 QR 확대" \
  --body "QR viewBox를 유지하고 300px 인식 영역과 흰색 여백을 적용합니다."
```

Manager 태그 제외 정책이면 태그는 만들지 않습니다. 필요한 경우에만 PR 병합과 CI 성공 후 `v1.0.0.11` 태그를 생성합니다.


git switch main
git pull --ff-only origin main
git tag -a v1.0.0.11 -m "IEUM Manager v1.0.0.11"
git push origin v1.0.0.11
