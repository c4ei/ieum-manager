# IEUM Manager v1.0.0.2

## 변경 내용

- `package.json`의 `1.0.0-2`에서 표시 버전 `1.0.0.2`를 자동 생성합니다.
- Chain 버전은 고정 문구 대신 온라인 RPC 노드들의 실제 버전을 집계합니다.
- 노드 버전이 서로 다르면 불일치 상태를 표시합니다.
- 이벤트 기반 블록 생성을 고정 슬롯 누락으로 계산하지 않습니다.
- `/start.html`에 일반 노드와 등록형 PoS 검증자 참여 차이를 설명합니다.
- `/buy.html`에서 1 AAH = 1 IEUM 구매 신청과 8자리 입금자명 확인코드를 제공합니다.
- 은행 입금은 자동 확인이 아니며 관리자가 코드·금액 확인 후 지급 거래 해시를 기록합니다.

## 운영 DB 마이그레이션

기존 PostgreSQL 볼륨에는 `db/init.sql`이 다시 실행되지 않으므로 배포 전에 다음 SQL을 한 번 적용합니다.

```bash
cd /opt/ieum-manager
sudo docker compose exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  < db/migrate-1.0.0.2.sql
```

docker exec -i ieum-manager_8787-postgres-1 \
  psql \
  -v ON_ERROR_STOP=1 \
  -U ieum \
  -d ieum_exp \
  < db/migrate-1.0.0.2.sql


환경변수를 쉘에서 사용할 수 없다면 `.env`의 실제 사용자·DB명으로 바꿉니다. SQL은 기존 주문을 삭제하지 않습니다.

## 적용·확인

```bash
docker compose up -d --build manager indexer
curl -fsS https://iem.aah.name/api/snapshot | python3 -m json.tool
```

확인 항목은 `managerVersion=1.0.0.2`, 실제 `chainVersion`, `/buy.html` 주문 생성, 관리자 입금 확인과 지급 거래 해시 기록입니다.

## Git 및 PR

```bash
bash scripts/commit-push-pr-v1.0.0.2.sh
```

PR 병합과 CI 성공 후:

```bash
git switch main
git pull --ff-only origin main
git tag -a v1.0.0.2 -m "IEUM Manager v1.0.0.2"
git push origin v1.0.0.2
```
