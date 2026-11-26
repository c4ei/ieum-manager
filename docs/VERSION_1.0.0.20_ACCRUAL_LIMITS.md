# IEUM Manager 1.0.0.20 · 적립 한도와 현황

| 구분 | 하루 한도 | 지키는 곳 |
|---|---|---|
| 출석 1회 | 0.001 IEUM (`IEUM_CHECKIN_ACCRUAL_WEI`) | Manager |
| 웹 보상 합계(출석·미션) | 0.01 IEUM (`IEUM_WEB_ACCRUAL_DAILY_CAP_WEI`) | Manager |
| 노드 적립 + 웹 보상 | 0.3 IEUM | IEUM Chain |
| 새로 적립을 시작하는 주소 | 하루 50개 (v7) | IEUM Chain 1.0.18.0 |

- 담보 100 IEUM을 채우는 주된 경로는 노드 적립이고, 출석은 매일 들르게 하는 작은 보너스입니다.
- `/admin/incidents`의 `노드 적립 현황`에서 적립 주소가 하루에 갑자기 늘어나는지 확인합니다.
- 노드를 대량으로 띄워도 주소당 0.3/일, 같은 /24·/48 대역 2대, 하루 신규 주소 50개 규칙이 함께 적용됩니다.

되돌리기: 환경 변수로 금액·상한을 바꾸고 `docker compose up -d manager`로 재시작합니다.
