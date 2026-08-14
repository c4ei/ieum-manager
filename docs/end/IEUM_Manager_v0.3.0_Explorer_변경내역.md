# IEUM Manager v0.3.0 Explorer 변경 내역

## 목표

운영 관제 화면을 읽기 전용 블록 익스플로러로 확장했다. PostgreSQL은 체인의 원장이 아니라 RPC에서 언제든 재구축할 수 있는 조회 인덱스다.

## 구현 완료

- 블록 높이·해시·생성자·시각·거래 수 인덱싱 및 조회
- 트랜잭션 해시 상세 조회
- 주소 잔액·송수신 거래 내역 조회
- 잔액 기준 Top 100 주소
- 최근 블록과 최근 트랜잭션 UI
- 토큰/NFT 테이블·API·화면 골격
- 설정 노드 자동 상태 수집, `ieum_peerInfo`가 생기면 동적 피어 자동 수집
- PostgreSQL 17, Manager, Indexer를 실행하는 Docker Compose
- 입력 검증, 파라미터 바인딩, 읽기 전용 공개 API

## 설치

```bash
cp .env.example .env
cp config.example.json config.json
nano .env
nano config.json
docker compose up -d --build
docker compose ps
docker compose logs -f indexer
curl http://127.0.0.1:8787/api/explorer/status
```

Docker에서 호스트 노드 RPC를 읽으므로 `config.json`은 `host.docker.internal`을 사용한다. Linux의 host-gateway 매핑은 Compose에 포함되어 있다. RPC가 특정 LAN IP에만 바인딩된 노드는 그 IP를 직접 입력한다.

## 체인 변경이 필요한 기능

### 동적 점 조직 노드 맵

현재 `net_peerCount`는 수만 제공한다. 전체 네트워크를 자동 발견하려면 `ieum-chain`에 인증 없는 읽기 전용 `ieum_peerInfo` RPC를 추가하는 것이 좋다.

권장 응답 필드: `nodeId`, `address`, `version`, `height`, `peerCount`, `direction`, `connectedSince`, `latencyMs`, `validatorId`. 개인정보나 내부 사설 IP는 기본적으로 마스킹해야 한다. Manager 인덱서는 이 RPC가 없어도 동작하며, 추가되면 자동으로 수집한다.

### 토큰과 NFT

현 체인의 `eth_getCode`, `eth_call`, `eth_getLogs`는 실질적 컨트랙트/로그 데이터를 제공하지 않는다. 토큰/NFT를 실제 발행·전송하려면 다음이 필요하다.

1. IEUM-20, IEUM-721, IEUM-1155 자산 표준 정의
2. 자산 생성·전송 상태 전이와 권한/공급량 규칙
3. 확정 블록의 표준 이벤트 로그와 `eth_getLogs`
4. 토큰 메타데이터 RPC 또는 결정적 온체인 메타데이터
5. 재조직 또는 롤백 시 인덱서 되돌리기 규약

UI는 지원 전에는 “준비 상태”라고 명확히 표시하며 가짜 토큰/NFT 정보를 만들지 않는다.

## 이후 추가 권장

- 블록 해시 직접 검색과 페이지네이션 URL
- 주소별 잔액 변화 시계열 및 대형 이동 알림
- 노드 토폴로지 그래프와 지리 정보(운영자 동의 기반)
- 검증자 상세, 누락 블록, 슬래싱/제재 이력
- 토큰 검증 배지 및 악성 메타데이터 차단
- DB 백업, 보존 기간, 인덱서 지연 경보
- OpenTelemetry/Prometheus와 관리자 로그인·감사 로그
- 통합 테스트용 고정 체인 fixture와 대규모 인덱싱 성능 시험

## 운영 주의

- PostgreSQL 포트는 외부에 공개하지 않는다.
- `.env`와 `config.json`은 커밋하지 않는다.
- Manager는 서명 키를 보관하지 않으며 쓰기 RPC를 노출하지 않는다.
- 초기 동기화 중에는 Top 100과 거래 수가 완성 전 값일 수 있다.
- 체인의 블록 해시가 같은 높이에서 바뀌는 상황을 운영 전에 정책으로 확정해야 한다.
