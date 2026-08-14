# IEUM Manager v0.3.3 변경 내역

- 표시 버전을 Manager `0.3.3`, Chain `0.22.4`로 갱신했습니다.
- Chain v0.22.4가 제네시스→1번 구간을 생산 통계에서 제외하므로 수십 년짜리 평균 시간과 대량 누락 슬롯 오표시가 사라집니다.
- 0번 제네시스 해시가 바뀌면 기존 v0.3.2 로직이 Explorer 인덱스를 비우고 0번부터 다시 수집합니다.

## 적용

Chain v0.22.4 네 노드의 0번 블록이 동일한 것을 먼저 확인한 뒤 실행합니다.

```bash
sudo docker compose up -d --build --force-recreate manager indexer
sudo docker compose logs -f indexer
```

`genesis block 0 not found`가 반복되면 Manager를 수정하지 말고 RPC의 `eth_getBlockByNumber(0x0)` 결과부터 확인하십시오.
