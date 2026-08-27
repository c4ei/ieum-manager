# IEUM Manager 1.0.0.3 — 한·영 백서

## 변경 내용

- `/whitepaper.html`에 반응형 한·영 백서를 추가했다.
- 실제 구현과 설계 참고를 분리하고, 성능·투자 수익을 과장하지 않는 공개 위험 문구를 포함했다.
- 100ms~5초 운영 프로파일과 코드상 100ms~15초 허용 범위, 기본 5초를 구분했다.
- Chain, Wallet, Cold Wallet, Manager GitHub 링크와 Ethereum, Solana, Cosmos 공식 참고 문서를 연결했다.
- 사람·검색엔진·AI가 읽을 수 있도록 semantic HTML, TechArticle JSON-LD, canonical, sitemap 및 Markdown 원문을 제공한다.

## 적용 파일

`package.json`, `package-lock.json`, `public/index.html`, `public/sitemap.xml`, `public/whitepaper.html`, `public/whitepaper.css`, `public/whitepaper.js`, `docs/WHITEPAPER_KO.md`, `docs/WHITEPAPER_EN.md`, `docs/VERSION_1.0.0.3_BILINGUAL_WHITEPAPER.md`, `test/whitepaper.test.js`

## 검사 및 배포

```bash
npm test
docker compose config >/dev/null
docker compose build --no-cache manager
docker compose up -d --force-recreate manager
curl -fsS https://iem.aah.name/whitepaper.html | grep 'IEUM Chain Whitepaper'
curl -fsS https://iem.aah.name/api/snapshot | grep -o '"managerVersion":"[^"]*"'
```

## GitHub 반영

```bash
git switch -c feature/bilingual-whitepaper
git add -- package.json package-lock.json public/index.html public/sitemap.xml public/whitepaper.html public/whitepaper.css public/whitepaper.js docs/WHITEPAPER_KO.md docs/WHITEPAPER_EN.md docs/VERSION_1.0.0.3_BILINGUAL_WHITEPAPER.md test/whitepaper.test.js
git commit -m "feat: add bilingual IEUM whitepaper"
git push -u origin feature/bilingual-whitepaper
```

`feature/bilingual-whitepaper` → `main` Draft PR을 만들고 CI 통과 후 병합한다. 병합 뒤 필요하면 `v1.0.0.3` annotated tag를 생성한다.
