# IEUM Manager 0.3.9
주소 : https://iem.aah.name
WAF 반영

docker compose up -d --force-recreate manager indexer

<img width="1372" height="965" alt="image" src="https://github.com/user-attachments/assets/1b615557-0b61-44dd-abc5-5774311581ce" />

# IEUM Manager 0.3.7

IEUM Chain 운영 관제와 PostgreSQL 기반 블록 익스플로러를 제공하는 읽기 전용 웹입니다. `/start.html`에서 초보자용 Wallet 다운로드, AAH로 IEUM 구매, Chain 노드 실행 안내를 제공합니다.

docker compose up -d --build manager indexer

## v0.3.1 Explorer

- 블록, 트랜잭션 해시, 주소 검색
- 최근 블록·거래와 주소별 송수신 이력
- Top 100 보유 주소
- 토큰/NFT 표준 연동 준비 API와 UI
- 설정 노드 및 향후 `ieum_peerInfo` 피어 자동 발견
- PostgreSQL 17 + Manager + Indexer Docker Compose

Docker 설치가 권장됩니다.

```bash
cp .env.example .env
cp config.example.json config.json
nano .env
nano config.json
docker compose up -d --build
docker compose logs -f indexer
```

상세 변경과 체인 코어 추가 요구사항은 `docs/IEUM_Manager_v0.3.1_Explorer_변경내역.md`를 참고하세요.

## 1차 제공 범위

- 4개 노드 온라인 여부, 높이, 블록 해시, 버전, 피어, 지연, 가동 시간, 메모리풀
- chainId/genesisHash 불일치, 노드 중단, 높이 지연, 동기화, 피어 0 자동 경보
- 지정한 운영 지갑의 잔액과 nonce
- 최근 최대 100개 블록의 거래·잔고 흐름
- 총발행량·유통량·잠금 잔액과 잠금 주소 수
- 전체 주소 잔액 인덱스(화면 표시량 설정 가능, 최대 1,000개)
- validator별 최근 확정 인증서 서명률
- 평균 블록 생성 시간·지연 구간·추정 누락 슬롯
- 브라우저에서 RPC에 직접 접속하지 않는 서버 프록시 구조
- 쓰기/송금/personal RPC가 전혀 없는 읽기 전용 UI

금액은 체인 RPC가 반환하는 10진 문자열 wei를 서버에서 안전하게 변환합니다. 브라우저의 JavaScript 정밀도 손실을 피하며 1 IEUM은 `10^18 wei`입니다.

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

### v0.3.9 관리자 제어

`/admin.html`은 `IEUM_MANAGER_ADMIN_TOKEN`(최소 32자) 인증 뒤에만 관리 API를 사용합니다. 토큰은 저장소나 `config.json`이 아닌 운영 `.env`에서만 주입하세요. 정책은 Manager와 인덱서가 신뢰할 RPC 소스를 차단하거나 조회 우선순위를 정하며 합의 투표권·블록 보상·채굴량은 변경하지 않습니다.

관리 API에는 요청 제한, 16 KiB 본문 제한, 동일 Origin, JSON Content-Type, HTTP 메서드 제한, 반복 인증 실패 15분 차단과 JSONL 감사 로그가 적용됩니다. `IEUM_MANAGER_TRUST_PROXY=1`은 Caddy/Cloudflare 뒤에서만 사용하고 Manager 포트를 인터넷에 직접 공개하지 마세요.

```bash
sudo systemctl status ieum-manager --no-pager
sudo journalctl -u ieum-manager -n 100 --no-pager
curl -s http://127.0.0.1:8787/api/snapshot
```

## v0.22.2 호환 관리 RPC

- `ieum_supplyStatus`
- `ieum_addressBalances`
- `ieum_validatorStatus`
- `ieum_blockProductionStatus`

구형 노드가 섞여 있으면 기본 노드 관제는 유지되고 피어 자동 발견이 제한됩니다. 네 노드를 모두 v0.22.2로 올린 뒤 사용하세요.

## 다음 단계

Prometheus/Grafana 장기 추세와 Alertmanager 알림을 함께 운영하고, 관리 웹에는 WebAuthn MFA와 역할 권한을 추가하는 것이 다음 단계입니다. 노드 재시작·업데이트·송금 같은 쓰기 기능은 별도 권한과 재인증, 이중 승인 절차가 마련된 후 분리해 추가해야 합니다.

v0.3.5부터 인덱서는 Chain ID, genesis hash, 확정 높이와 블록 해시가 동일한 독립
RPC 2개 이상의 quorum이 없으면 인덱싱을 중단합니다. 인증 snapshot 누락은 운영
화면에 critical 경보로 표시합니다. 자세한 내용은
[`docs/IEUM_Manager_v0.3.5_Quorum_Snapshot_변경내역.md`](docs/IEUM_Manager_v0.3.5_Quorum_Snapshot_변경내역.md)를 참고하세요.

v0.3.6에서는 운영 Chain v0.22.5의 실제 genesis hash를 반영하고 GitHub Actions
CI를 추가했습니다. 적용 전에는
[`docs/IEUM_Manager_v0.3.6_운영_정합성_변경내역.md`](docs/IEUM_Manager_v0.3.6_운영_정합성_변경내역.md)를 확인하세요.

v0.3.7에서는 모든 IEUM 잔액과 Explorer 거래 수량을 소수점 8자리에서 정확히
반올림하고 뒤쪽 0을 제거합니다. 자세한 내용은
[`docs/IEUM_Manager_v0.3.7_IEUM_수량_표시_버그픽스.md`](docs/IEUM_Manager_v0.3.7_IEUM_수량_표시_버그픽스.md)를 확인하세요.
