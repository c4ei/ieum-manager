# IEUM Manager v0.3.5 Quorum·Snapshot 운영 보강

## 변경 사항

- 더 이상 응답이 빠른 첫 RPC를 무조건 신뢰하지 않습니다.
- Chain ID `21004`, 고정 genesis hash, 확정 높이, 확정 블록 해시가 동일한 독립 노드
  2개 이상을 인덱싱 quorum으로 선택합니다.
- quorum이 없으면 인덱싱을 중단하고 오류를 남깁니다. 서로 다른 체인의 데이터를
  PostgreSQL에 섞지 않습니다.
- 이미 저장한 높이의 블록 해시가 바뀌거나 부모 해시가 이어지지 않으면 확정성 위반으로
  처리하고 자동 덮어쓰기를 중단합니다.
- Chain v0.22.5의 `ieum_getStorageStatus`를 이용해 최신 체크포인트가 2/3 인증되지
  않았거나 인증 snapshot이 하나도 없으면 critical 경보를 표시합니다.
- 표시 호환 버전을 Chain v0.22.5, Wallet v0.0.10.10으로 갱신했습니다.

## 운영 설정

`config.json`에 다음 값을 유지하세요.

```json
{
  "expectedChainId": 21004,
  "expectedGenesisHash": "0x9cfb8866763ced88e3b66778013314017783d4cbc6e6cd735cf4fa118abcd944",
  "indexQuorumPeers": 2
}
```

## 검증

```bash
npm ci
npm test
docker compose config
#docker compose up -d --build manager indexer
docker compose up -d --build --force-recreate manager indexer
docker compose logs -f indexer
```

PostgreSQL PITR, 외부 Prometheus/Grafana/Alertmanager, 공개 Explorer와 비공개 운영
Manager의 물리적 분리는 배포 인프라 작업이므로 저장소 비밀값 없이 별도로 적용해야
합니다.
