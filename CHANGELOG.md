# IEUM Manager 변경 내역

## 0.3.18 - 2026-08-18

- 공개 대시보드의 연결 피어 카드를 AAH 관리자 JWT일 때만 상세 화면 링크로 활성화
- 관리자 전용 `/admin/peers`, `/api/admin/peers` 및 개별 피어 조회 API 추가
- Node ID 기준 고유 피어, IP/포트, 국가, 버전, 높이, 방향, 관측 시각, 수집 노드와 선택적 지갑·토폴로지 정보 표시
- 인덱서 주기 시작 시 이전 외부 피어를 오프라인 처리하여 오래된 온라인 상태 방지
- 좌측 IEUM 로고 클릭 및 키보드 조작 시 첫 페이지로 이동

## 0.3.11 - 2026-08-13

- AAH `.aah.name` 공유 `token` JWT와 동일한 `JWT_SECRET`으로 관리자 SSO 연동
- 비상용 Manager 토큰 로그인은 보조 인증으로 유지
- 관리자 Dashboard, RPC, WAF, 차단 IP, 감사 로그 URL 분리
- 공개 Nodes, Validators, Accounts 상세 화면과 25개 단위 페이지네이션
- LIVE NETWORK 표시 시계는 1초, 네트워크 데이터는 5초 간격 갱신

## 0.3.10 - 2026-08-13

- AAH 관리자 WAF를 참고한 monitor/block, 점수, TTL, IP allow/block 및 자동 격리 UI
- WAF 차단·감시·인증 실패 감사 로그를 관리자 화면에서 조회
- 관리자 정책과 감사 로그를 Docker 영구 볼륨으로 보존
- CI Compose 검증과 이미지 빌드에 비밀이 아닌 전용 placeholder 제공
- CI에서 PostgreSQL을 시작하지 않고 Manager/Indexer 이미지만 빌드 검증

## 0.3.9 - 2026-08-13

- 검증자 서명률은 최소 20개 확정 인증서 전까지 `표본 부족`으로 표시
- genesis와 첫 운영 블록 간격을 평균 블록 시간에서 제외하고 생성·서명 수를 분리
- 관리자 인증, RPC 소스 차단·조회 우선순위, 즉시 재점검, 감사 로그 추가
- 관리자 API WAF, 속도·본문·Origin·메서드·Content-Type 제한 추가

## 0.3.8 - 2026-08-13

- GitHub Actions의 Docker Compose 검증에 CI 전용 `POSTGRES_PASSWORD`를 제공
- 저장소에 포함하지 않는 운영 `.env` 없이도 `docker compose config` 검증이 통과하도록 수정
- 실제 운영 비밀번호와 GitHub Secrets를 사용하지 않는 안전한 구성 검증 방식 적용

## 0.3.3 - 2026-08-12

- 표시 호환 버전을 IEUM Chain v0.22.4로 갱신
- 새 제네시스 해시 감지 시 0번부터 Explorer 재인덱싱하는 v0.3.2 동작 유지
- Chain 생산 통계의 제네시스 구간 제외와 연동

## 0.3.1 - 2026-08-12

- 블록/트랜잭션 해시 판별과 블록 해시 직접 검색 추가
- 블록·트랜잭션 목록의 URL 기반 페이지네이션 추가
- IEUM Chain v0.22.2 `ieum_peerInfo` 토폴로지 수집 연동

## 0.3.0 - 2026-08-12

- PostgreSQL 블록/트랜잭션/주소 인덱서 추가
- 블록 높이, 트랜잭션 해시, 주소 검색 UI와 API 추가
- Top 100 보유 주소, 최근 블록/거래 화면 추가
- 토큰 및 NFT 표준 연동 준비 스키마/API/UI 추가
- 설정 노드 수 자동 확장 및 `ieum_peerInfo` 동적 피어 수집 준비
- PostgreSQL 17, Manager, Indexer Docker Compose 추가
- 체인 코어 후속 요구사항과 운영 문서 추가

## 0.2.0 - 2026-08-12

- IEUM Chain v0.22.1 호환
- 총발행량, 유통량, 잠금 잔액 표시
- 전체 주소 잔액 인덱스 표시
- validator 서명률과 블록 생성 상태 표시
- 서명률 및 블록 지연 경보 추가
- 운영 관제 대시보드 UI 전면 개편

## 0.1.0

- 4개 노드, 지정 지갑, 최근 거래 읽기 전용 관제
