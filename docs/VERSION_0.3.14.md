# IEUM Manager v0.3.14 — Explorer 상세 URL

## 수정 사항

- 64자리 해시는 0x 접두사가 없어도 자동으로 정규화합니다.
- 검색 결과를 같은 화면에 임시 출력하지 않고 정식 상세 URL로 이동합니다.
- 트랜잭션: /tx/{hash}
- 주소: /address/{address}
- 블록 높이 또는 해시: /block/{height-or-hash}
- 상세 화면에서 블록, 거래, 보내는 주소와 받는 주소를 서로 이동할 수 있습니다.
- 존재하지 않는 거래와 인덱서 미수집 거래는 상세 화면에서 명확한 오류를 표시합니다.

## 확인된 입력 해시

cf91fb3db2bac80635129cb54a9f6eaecefca2e100853000033eceb424de3574 는 0x 누락 문제와 별개로 현재 Explorer DB 및 운영 RPC에서 조회되지 않았습니다. 따라서 URL 처리가 수정된 뒤에도 원장에 존재하지 않는 해시라면 찾을 수 없음이 정상입니다.

## 검증

    node --check public/app.js
    node --check public/detail.js
    node --check server.js
    npm test

## 배포

    git add public server.js test package.json package-lock.json docs/VERSION_0.3.14.md
    git commit -m "feat: add explorer entity detail routes"
    git push origin main
    git tag -a v0.3.14 -m "IEUM Manager v0.3.14"
    git push origin v0.3.14
