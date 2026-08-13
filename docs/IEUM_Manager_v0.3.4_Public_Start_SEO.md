# IEUM Manager v0.3.4 공개 시작 페이지·SEO

- `/start.html`: Wallet 다운로드, AAH 구매, Chain 노드 실행 안내
- 공식 Chain·Wallet·Manager GitHub 연결
- `https://aah.name/ieum/buy` 구매 연결
- title, description, canonical, Open Graph, robots, sitemap 적용
- Manager의 읽기 전용·무개인키 원칙 유지

```bash
npm test
node --check server.js
curl -I https://iem.aah.name/start.html
curl -I https://iem.aah.name/sitemap.xml
```

공개 도메인이 다르면 HTML canonical/OG URL과 robots·sitemap 호스트를 함께 변경합니다.
