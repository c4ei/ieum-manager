# IEUM Manager v0.3.6 운영 정합성 보강

## 변경 사항

- Chain v0.22.5 `config/genesis.json`을 Rust 직렬화 규칙과 동일하게 계산한 genesis
  hash `0x497e04ac4faec01b78b57d3caef7951fca98b1928a1af558ea03a663aa622418`을
  인덱서 기본값과 예제 설정에 반영했습니다.
- v0.3.5의 이전 hash `0x9cfb...944`는 정상 운영 노드를 quorum에서 제외하므로
  사용하지 않습니다.
- 예제 설정의 Chain ID와 genesis hash가 바뀌면 테스트가 실패하도록 회귀 검사를
  추가했습니다.
- push, pull request, 수동 실행에서 `npm ci`, `npm test`, `docker compose config`를
  수행하는 GitHub Actions CI를 추가했습니다.
- 호환 Wallet 표기를 v0.0.10.12로 갱신했습니다.

## 적용 전 필수 확인

실제 운영 `config.json`은 예제 파일을 자동으로 덮어쓰지 않습니다. 다음 값을 직접
확인하고 서비스 재시작 전에 모든 RPC가 같은 결과를 반환하는지 검사하세요.

```json
{
  "expectedChainId": 21004,
  "expectedGenesisHash": "0x497e04ac4faec01b78b57d3caef7951fca98b1928a1af558ea03a663aa622418",
  "indexQuorumPeers": 2
}
```

```bash
npm ci
npm test
docker compose config
docker compose up -d --build --force-recreate manager indexer
docker compose logs -f indexer
```

인덱서 로그에서 두 개 이상의 독립 RPC가 동일한 확정 높이·해시를 보고하는지 확인한
뒤 공개 Explorer를 전환합니다.
