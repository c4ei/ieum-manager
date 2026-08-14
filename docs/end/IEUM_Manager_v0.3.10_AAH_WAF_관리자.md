# IEUM Manager v0.3.10 AAH WAF 관리자

AAH 관리자 WAF 화면과 정책 구조를 참고하여 IEUM Manager에 필요한 기능만 이식했습니다. AAH의 회원·결제·텔레그램·운영 DB 데이터와 비밀값은 포함하지 않습니다.

## 기능

- WAF monitor/block 모드, 차단 점수, 차단 TTL
- `.env`, `.git`, WordPress/PHP 스캔, 백업 파일, SQLi/XSS, 경로 순회, 스캐너 UA 점수화
- 수동 IP allow/block과 자동 격리·해제
- 차단·감시·인증 실패·정책 변경 감사 이벤트 조회
- RPC 소스 차단과 조회 우선순위
- 정책과 로그 Docker 영구 볼륨 보존

Redis는 넣지 않았습니다. 단일 Manager에서는 영구 JSON 정책과 JSONL 감사 로그가 단순하고 충분합니다. 여러 Manager 인스턴스가 같은 차단 상태와 rate limit을 공유해야 할 때 Redis를 추가합니다.

## CI와 PostgreSQL

CI는 placeholder 환경변수로 `docker compose config`를 검증하고 `docker compose build manager indexer`만 실행합니다. 이 명령은 PostgreSQL 컨테이너를 시작하거나 연결하지 않습니다. PostgreSQL healthcheck 의존성은 실제 `docker compose up` 운영 기동에만 적용됩니다.
