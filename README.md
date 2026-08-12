# IEUM Manager 0.1.0

IEUM Chain 4개 운영 노드를 한 화면에서 확인하는 읽기 전용 관제 웹입니다. `ieum-chain v0.21.13`의 실제 JSON-RPC(`ieum_nodeStatus`, `ieum_networkIdentity`, `ieum_protocolVersion`, `ieum_finalizedBlock`, `ieum_getStorageStatus`, `txpool_status`, Ethereum 호환 조회 메서드)에 맞춰 작성되었습니다.

## 1차 제공 범위

- 4개 노드 온라인 여부, 높이, 블록 해시, 버전, 피어, 지연, 가동 시간, 메모리풀
- chainId/genesisHash 불일치, 노드 중단, 높이 지연, 동기화, 피어 0 자동 경보
- 지정한 운영 지갑의 잔액과 nonce
- 최근 최대 100개 블록의 거래·잔고 흐름
- 브라우저에서 RPC에 직접 접속하지 않는 서버 프록시 구조
- 쓰기/송금/personal RPC가 전혀 없는 읽기 전용 UI

> 현재 체인 RPC에는 전체 발행량과 모든 주소 목록을 집계하는 API가 없습니다. 따라서 "전체 잔액"은 `config.json`에 등록한 관리 주소 합계까지 정확하게 제공할 수 있고, 전 계정 총공급량은 체인 코어에 별도 RPC를 추가해야 합니다.

## 설치

```bash
sudo mkdir -p /opt/ieum-manager
sudo cp -a . /opt/ieum-manager/
cd /opt/ieum-manager
cp config.example.json config.json
nano config.json
npm test
sudo cp deploy/ieum-manager.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ieum-manager
curl http://127.0.0.1:8787/api/health
```

기본 RPC 포트는 단일 서버 4노드 구성인 `8989`, `8990`, `8991`, `8992`입니다. 실제 포트와 지갑 주소를 `config.json`에서 바꾸세요. 주소가 정확한 `0x` + 40자리 16진수일 때만 조회합니다.

## 외부 공개

관리 웹 자체는 `127.0.0.1:8787`에만 바인딩됩니다. `deploy/Caddyfile.example`을 현재 Caddyfile에 반영하고, 반드시 TLS와 `basic_auth` 또는 Cloudflare Access/VPN을 사용하세요.

```bash
caddy hash-password
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

RPC 포트(8989~8992)는 인터넷에 직접 공개하지 마세요. Manager는 조회 전용이므로 validator key, node key, mnemonic, keystore 비밀번호를 설정 파일에 넣지 않습니다.

## 운영 확인

```bash
sudo systemctl status ieum-manager --no-pager
sudo journalctl -u ieum-manager -n 100 --no-pager
curl -s http://127.0.0.1:8787/api/snapshot
```

## 다음 단계

2차에서는 코어에 `ieum_supplyStatus`, validator set/서명률, 블록 생성 시간, 체인 전체 주소별 잔액 인덱스 API를 먼저 추가한 뒤 Prometheus/Grafana 장기 추세, 알림 전송, 감사 로그를 연결하는 것이 안전합니다. 노드 재시작·업데이트·송금 같은 쓰기 기능은 별도 권한과 재인증, 승인 절차가 마련된 후 분리해 추가해야 합니다.
