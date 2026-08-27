# IEUM Manager v0.3.16 — 기존 길드 결제 해시 호환

## 원인

Chain v0.23.0 이하에서 Wallet에 반환한 raw 거래 해시와 확정 블록에 기록한 원장 거래 해시가 달라 사용자가 Wallet의 해시를 입력하면 Manager 인덱스에서 찾을 수 없었습니다.

## 변경

- 재단지갑 주소를 소문자로 통일했습니다.
- 입력 해시가 직접 조회되지 않을 때 보내는 지갑, 재단지갑, 1 IEUM 이상, 미사용 조건이 모두 일치하는 확정 결제를 찾습니다.
- 후보가 정확히 한 건일 때만 호환 처리하고 원장에 기록된 정식 해시를 사용 이력에 저장합니다.
- 후보가 여러 건이면 자동 선택하지 않고 Explorer의 정식 해시 입력을 요구합니다.
- 입력 해시와 정식 원장 해시를 응답에 함께 남겨 추적성을 보존합니다.

## 검증

    npm test
    node --check server.js

## 적용

Indexer가 최신 확정 블록까지 동기화된 상태에서 기존 Wallet 해시로 길드 생성을 다시 요청합니다. 이미 사용된 정식 결제는 재사용할 수 없습니다.



docker compose config >/dev/null
docker compose build --no-cache manager
docker compose up -d --force-recreate manager


git push origin HEAD:main
git tag -a v0.3.16 -m "IEUM Manager v0.3.16"
git push origin v0.3.16
