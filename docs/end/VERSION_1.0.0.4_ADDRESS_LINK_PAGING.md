# IEUM Manager v1.0.0.4 — 주소 판별·링크 대비·목록 페이징

작업일: 2026-08-26

## 변경 내용

- IEUM 계정 주소(`0x` + 40자리)와 32바이트 해시·검증자 식별자(64자리)를 구분합니다.
- 64자리 값을 `/address/...`로 직접 열면 막연한 조회 실패 대신 올바른 주소 형식을 안내합니다.
- 제네시스 배정 계정에 일반 거래가 없을 때 `최근 블록 0` 대신 `제네시스 배정 · 일반 거래 없음`으로 표시합니다.
- 주소 링크 생성 시 계정 주소 형식을 검증하여 검증자 ID 등 다른 식별자에는 주소 링크를 만들지 않습니다.
- 어두운 배경에서 방문 전·방문 후 링크를 모두 밝은 민트색으로 고정하고 hover·키보드 focus 대비를 강화했습니다.
- Top 100 보유 주소, 전체 계정 잔액, 최근 온체인 흐름을 각각 페이지당 15행으로 표시합니다.
- Manager 패키지 및 화면 표시 버전을 `1.0.0.4`로 올렸습니다.

## GitHub 버전 대조

2026-08-26 각 저장소 `main` 기준입니다.

| 구성요소 | GitHub 소스 버전 | Manager 처리 |
| --- | --- | --- |
| IEUM Chain | `1.0.5.1` (`Cargo.toml`의 `1.0.5-1`, 태그 `v1.0.5.1`) | RPC 노드가 반환한 실제 버전을 화면에 동적으로 표시 |
| IEUM Wallet | `1.0.1.1` (`version.json`, 앱 패키지 `1.0.1-1`) | 고정 버전을 내장하지 않고 GitHub 다운로드로 연결 |
| IEUM Cold Wallet | `0.2.4` | 고정 버전을 내장하지 않고 GitHub 다운로드로 연결 |
| IEUM Manager | `1.0.0.4` (`package.json`의 `1.0.0-4`) | 패키지 메타데이터에서 화면 버전 자동 생성 |

Manager 실행 소스에는 오래된 Chain·Wallet 릴리스 번호가 고정되어 있지 않습니다. `README.md`와 과거 `docs/`에 남은 이전 버전은 당시 변경 이력이며 현재 실행 버전으로 사용되지 않습니다.

## 확인 방법

```bash
npm test
node --check server.js
node --check public/app.js
node --check public/detail.js
```

배포 후 다음 주소를 확인합니다.

- `/address/0x7ea8c617ad2635fa7bcfbb66056c3280df0987f4`
- `/address/d475e3a8a10a569c05c3d6406bb37adc681f5372e5855ffd76d24d5df91cad5d`
- 메인 화면의 Top 100, 전체 계정 잔액, 최근 온체인 흐름 페이징


## 운영 반영 확인

```bash
docker compose build --no-cache manager indexer
docker compose up -d --force-recreate manager indexer
curl -fsS https://iem.aah.name/api/snapshot | grep -o '"managerVersion":"[^"]*"'
```