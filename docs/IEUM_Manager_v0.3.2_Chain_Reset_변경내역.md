# IEUM Manager v0.3.2 변경 내역

- IEUM Chain v0.22.3의 실제 0번 제네시스 블록을 인덱싱합니다.
- 저장된 `genesis_hash`가 바뀌거나 이전 인덱스 높이가 새 tip보다 높으면 체인 초기화로 판단합니다.
- 체인 초기화 시 블록, 거래, 주소 집계, 토큰 전송 인덱스를 비우고 0번부터 다시 수집합니다.
- 노드 관제 및 수동 등록된 토큰 정의는 유지합니다.

```bash
sudo docker compose up -d --build --force-recreate manager indexer
sudo docker compose logs -f indexer
```
