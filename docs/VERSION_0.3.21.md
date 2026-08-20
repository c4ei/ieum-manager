# IEUM Manager v0.3.21 — IEUM·wei 공통 표시

## 표시 기준

- 원본 금액은 `BigInt`로 처리해 큰 잔액의 정밀도를 잃지 않는다.
- 기본 표시는 IEUM 소수점 최대 8자리까지 반올림하며 뒤쪽 0을 제거한다. 예: `1.1200` → `1.12 IEUM`.
- 정확히 정수 IEUM이면 중복되는 wei 표시는 생략한다.
- 소수 단위 잔액·거래·수수료는 정확한 원본 wei를 작은 보조 글씨로 함께 표시한다.
- 주소, 블록, 거래 상세와 목록의 From/To 주소를 클릭 가능한 주소 상세 링크로 통일한다.

공통 구현은 `public/amount-format.js`의 `formatIeum`, `formatWei`, `amountHtml`을 사용한다.

## 테스트

```bash
npm ci
npm test
```

## dev 커밋과 PR

```bash
git switch dev
git pull --ff-only origin dev
git status
git add CHANGELOG.md README.md package.json package-lock.json server.js \
  public/amount-format.css public/amount-format.js public/app.js \
  public/detail.js public/detail.html public/index.html \
  test/amount-format.test.js docs/VERSION_0.3.21.md
git commit -m "feat: unify IEUM amount formatting v0.3.21"
git push origin dev

gh pr create --base main --head dev \
  --title "IEUM Manager v0.3.21 amount formatting" \
  --body "IEUM/wei 공통 포맷, 소수 반올림, 정확한 wei 보조 표시와 주소 링크를 적용합니다."
```

Actions 통과 후 PR을 머지하고 태그를 만든다.

```bash
git switch main
git pull --ff-only origin main
test "$(node -p "require('./package.json').version")" = "0.3.21"
git tag -a v0.3.21 -m "IEUM Manager v0.3.21"
git push origin v0.3.21
```

## 운영 반영 확인

```bash
docker compose build --no-cache manager indexer
docker compose up -d --force-recreate manager indexer
curl -fsS https://iem.aah.name/api/snapshot | grep -o '"managerVersion":"[^"]*"'
```

예상값은 `"managerVersion":"0.3.21"`이다.
