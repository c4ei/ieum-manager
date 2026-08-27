# IEUM Manager agent guide

작업 전에 `docs/PROJECT_CONTINUITY.md`, `README.md`, 최신 `docs/VERSION_*`, 두 백서와 `SECURITY.md`를 읽는다.

## 현재 기준

- 패키지 버전: `1.0.0-12`
- 사용자 표시: `1.0.0.12`
- 운영 URL: https://iem.aah.name
- Node.js `>=20`, PostgreSQL 17, Manager/Indexer Docker 구성
- 브라우저가 노드 RPC에 직접 연결하지 않는 서버 프록시·읽기 중심 구조

## 필수 불변조건

- RPC `8989`~`8992`, Manager `8787`, PostgreSQL을 인터넷에 직접 공개하지 않는다.
- admin JWT/token, 운영 `.env`, DB 자격증명, validator/node key를 저장소나 응답에 넣지 않는다.
- 인덱서는 Chain ID, genesis hash, 높이·블록 hash와 독립 RPC quorum을 확인한다.
- IEUM 금액은 정밀 문자열/BigInt 계열로 처리하며 JavaScript Number로 wei를 계산하지 않는다.
- 상품권은 누적 발행, 유효 발행, 사용, 폐기, 만료를 구분한다. 재출력·지급은 권한, 감사 이력, 멱등 복구를 유지한다.
- 쓰기·재시작·복구 기능은 진단 UI와 분리하고 재인증·최소 권한을 지킨다.

## 변경 절차

1. `dev`가 `main`보다 뒤인지 확인하고 먼저 동기화한다.
2. 동작 변경은 `package.json` 마지막 버전 +1, `docs/VERSION_<display>_<TOPIC>.md`, README/CHANGELOG, 테스트를 함께 갱신한다.
3. DB 변경은 순방향 마이그레이션, 기존 데이터 보존, 재실행 안전성, 롤백/복구 방법을 문서화한다.
4. Draft PR과 성공한 CI 뒤에만 `main`에 병합한다.

## 필수 검증

```bash
npm ci
npm test
docker compose config >/dev/null
docker compose build manager indexer
```

운영 적용 뒤에는 `/api/health`, 인덱서 높이, 네 노드 신원, 공개 화면과 관리자 권한 경계를 확인한다. GitHub CI만으로 운영 정상이라고 단정하지 않는다.
