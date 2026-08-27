# IEUM Manager v1.0.0.1 운영 안정화

화면 표시 버전은 `1.0.0.1`, npm 내부 버전은 `1.0.0-1`입니다.

## 주의

신규 거래는 영수증 기준 실제 수수료로 저장되며, 기존 거래도 인덱서 주기마다 최대
200개씩 자동 보정됩니다. 별도의 DB 삭제나 재인덱싱은 필요하지 않습니다.

```bash
npm ci
npm test
POSTGRES_PASSWORD=ci-only-placeholder \
IEUM_MANAGER_ADMIN_TOKEN=ci-only-placeholder-32-characters-minimum \
JWT_SECRET=ci-only-jwt-secret-not-for-production \
docker compose config
```

```bash
git switch dev
git pull --ff-only origin dev
git add -- package.json package-lock.json indexer.js server.js lib/transaction-fee.js \
  public/app.js public/index.html test/amount-format.test.js test/server.test.js test/transaction-fee.test.js README.md CHANGELOG.md \
  docs/VERSION_1.0.0.1_OPERATION_FINAL.md
git commit -m "release: IEUM Manager v1.0.0.1 operational final"
git push origin dev
```

`dev → main` PR을 병합한 뒤 서버에서 실행합니다.

```bash
git switch main
git pull --ff-only origin main
git tag -a v1.0.0.1 -m "IEUM Manager v1.0.0.1"
git push origin v1.0.0.1

docker compose build --no-cache manager indexer
docker compose up -d manager indexer
curl -fsS https://iem.aah.name/api/snapshot | grep -o '"managerVersion":"[^"]*"'
```

예상값은 `"managerVersion":"1.0.0.1"`입니다.
