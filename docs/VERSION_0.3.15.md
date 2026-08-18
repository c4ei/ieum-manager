# IEUM Manager v0.3.15 — 상세 화면 다국어 보완

## 변경 사항

- tx, address, block 상세 페이지의 제목, 표 머리글과 조회 실패 안내를 한국어/English 전환 대상에 포함했습니다.
- 동적으로 생성되는 상세 화면도 선택 언어가 유지됩니다.
- Manager 버전을 0.3.15로 올렸습니다.

## 검증

    node --check public/i18n.js
    node --check public/detail.js
    node --check server.js
    npm test
