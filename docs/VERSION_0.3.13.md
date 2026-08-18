# IEUM Manager v0.3.13 — 영어 UI와 체인 버전 정합성

## 변경 사항

- Overview, Explorer, 상세 관제, 시작하기, 길드, 관리자 화면에 공통 한국어/English 선택기를 추가했습니다.
- 선택 언어를 저장하고 동적으로 갱신되는 관제·Explorer 텍스트도 번역합니다.
- Snapshot의 고정 chainVersion 0.22.9를 제거하고 기준 온라인 노드가 보고하는 실제 버전을 반환합니다.
- Manager 버전을 0.3.13으로 올렸습니다.

## 검증 및 배포

    npm ci
    npm test
    git add public server.js package.json package-lock.json docs/VERSION_0.3.13.md
    git commit -m "feat: add English localization and live chain version"
    git push origin main
    git tag -a v0.3.13 -m "IEUM Manager v0.3.13"
    git push origin v0.3.13

수동 확인: 각 페이지에서 English 선택 후 새로고침, 5초 Snapshot 갱신, Explorer 검색·페이지 이동, 관리자 인증 화면을 확인합니다.
