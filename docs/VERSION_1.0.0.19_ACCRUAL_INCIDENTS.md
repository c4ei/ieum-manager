# IEUM Manager 1.0.0.19 · 출석 적립과 사고 대응

IEUM Chain 1.0.17.0(프로토콜 v6)의 잠긴 적립 거래와 계정 동결·복구 이벤트를 Manager에서 쉽게 쓰도록 연결합니다.

## 1. 매일 출석 적립 `/checkin`

- 사용자는 지갑 주소만 넣고 `오늘 출석하기`를 누릅니다. 개인키는 받지 않습니다.
- AAH 로그인 계정마다, 주소마다 KST 하루 1회입니다(`ieum_accrual_checkins` 고유 인덱스).
- 운영 지갑이 스테이킹 시스템 주소로 `value=적립액`, `data="accrue:0x받는주소"` 거래를 보냅니다.
  받는 주소에는 보낼 수 없는 잠긴 적립으로만 쌓이고, 100 IEUM이 되면 노드 담보로 인정됩니다.
- 한 주소의 하루 적립은 노드 적립과 합쳐 0.3 IEUM까지이며 체인이 강제합니다. 체인이 거절하면 기록을 지워 다시 시도할 수 있습니다.
- 금액: `IEUM_CHECKIN_ACCRUAL_WEI`(기본 0.1 IEUM, `0`이면 끔).
- 진행 막대 API(로그인 불필요): `GET /api/rewards/accrual?address=0x...`

## 2. 사고 대응 `/admin/incidents`

| 단계 | 화면 | 체인 동작 |
|---|---|---|
| 주소 조회 | 잔액·잠긴 적립·동결 상태 | `ieum_freezeStatus`, `ieum_accrualStatus` |
| 동결 | 사건 ID, 공개 사유, 주소 | `account_freeze` · 보내기만 막힘 |
| 복구(7일 뒤) | 해커 주소, `주소,금액` 줄 목록 | `account_recovery` · 유예 전이면 화면이 미리 거절 |
| 해제 | 사건 ID, 주소 | `account_unfreeze` · 없으면 30일 뒤 자동 해제 |

- 요청마다 확인 문구(`FREEZE 사건ID` 등)를 정확히 입력해야 합니다.
- Manager 컨테이너는 노드 파일을 직접 고치지 않습니다. control 폴더에 요청 파일만 남기고,
  호스트 에이전트(`deploy/ieum-recovery-agent.sh`)가 형식을 다시 검사한 뒤 네 노드 `config/events.json`에 같은 이벤트를 넣습니다.
  하나라도 실패하면 모두 되돌리고 `rejected`로 기록합니다. 노드는 5초 안에 파일을 다시 읽습니다.
- 공개 사유는 체인에 영구 기록되므로 개인정보를 쓰지 않습니다.

## 3. 설치

```bash
# 1) 이미지 재빌드(시작할 때 DB 마이그레이션 자동 적용)
docker compose up -d --build manager

# 2) 호스트 에이전트(처음 한 번). 토큰은 32자 이상 무작위 값으로 .env와 /etc/ieum-manager-recovery.env에 같은 값을 넣습니다.
sudo install -D -m 755 deploy/ieum-recovery-agent.sh /opt/ieum-manager/deploy/ieum-recovery-agent.sh
sudo install -m 644 deploy/ieum-recovery-agent.service deploy/ieum-recovery-agent.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now ieum-recovery-agent.timer
```

`/etc/ieum-manager-recovery.env` 예시(값은 직접 생성):

```
IEUM_RECOVERY_CONTROL_TOKEN=<32자 이상 무작위>
IEUM_RECOVERY_CONTROL_HOST_DIR=<docker-compose의 control 폴더 절대경로>
IEUM_NODE_DIRS=/opt/ieum-node1 /opt/ieum-node2 /opt/ieum-node3 /opt/ieum-node4
```

## 4. 되돌리기

- 출석 적립 끄기: `IEUM_CHECKIN_ACCRUAL_WEI=0` 후 재시작.
- 잘못 넣은 이벤트: 실행 전이면 각 노드 `events.json.<시각>` 백업으로 되돌립니다. 이미 실행된 동결은 `해제` 요청으로 풉니다.
- DB: 새 테이블 두 개는 다른 테이블이 참조하지 않아 그대로 두어도 이전 버전이 동작합니다.
