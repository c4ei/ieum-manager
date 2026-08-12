# IEUM Manager v0.3.1 Explorer 변경 내역

- 32바이트 해시를 PostgreSQL에서 판별하는 블록 해시 직접 검색
- `?blocks=2&txs=3` 블록·트랜잭션 독립 페이지 URL
- `?q=검색값#explorer` 공유·북마크 가능한 상세 검색 URL
- Chain v0.22.2 `ieum_peerInfo` 자동 인덱싱

API: `/api/explorer/blocks?limit=10&page=2`, `/api/explorer/transactions?limit=10&page=2`, `/api/explorer/block/hash/{hash}`. 목록 응답은 `pagination`에 page/pages/total/previous/next를 포함합니다.

적용은 Chain v0.22.2를 먼저 롤링 배포한 뒤 `docker compose up -d --build manager indexer`로 Manager를 재생성합니다.

이후 권장: 피어 edge 그래프, 연결 이력/가용성 추세, IEUM-20/721/1155 실행 표준 및 확정 이벤트 로그 RPC, 상세 페이지 canonical URL/OpenGraph.
