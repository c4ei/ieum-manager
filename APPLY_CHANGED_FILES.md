# IEUM Manager v0.3.22 변경분 적용

```bash
cd ~/www/ieum-manager
git switch dev
tar -xJf ~/다운로드/ieum-manager-v0.3.22-changed-only.tar.xz
npm ci
npm test
```

PR을 main에 병합한 뒤 `docs/VERSION_0.3.22_CHAIN_DOCTOR.md`의 호스트 에이전트 설치를
먼저 완료하고 Manager를 다시 빌드합니다. 복구 토큰을 설정하지 않으면 Chain Doctor의
진단은 작동하지만 재시작 버튼은 비활성으로 유지됩니다.

```bash
docker compose build --no-cache manager indexer
docker compose up -d --force-recreate manager indexer
curl -fsS https://iem.aah.name/api/snapshot | grep -o '"managerVersion":"[^"]*"'
```

기대값은 `managerVersion":"0.3.22"`입니다.
