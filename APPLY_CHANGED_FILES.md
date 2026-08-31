# IEUM Manager v1.0.0.18 변경분 적용

압축은 저장소 루트에서 상대 경로를 유지한다. 기존 파일을 백업하고 아래 순서로 적용한다.

```bash
cd ~/www/ieum-manager
tar -xJf ~/다운로드/ieum-manager-v1.0.0.18-trial-email-audience-changed-only.tar.xz
cp .env.example .env.v1.0.0.18.example
nano .env
sudo docker compose exec -T postgres psql -U "${POSTGRES_USER:-ieum}" -d "${POSTGRES_DB:-ieum_exp}" < db/migrate-1.0.0.18.sql
npm ci
npm test
sudo docker compose config --quiet
sudo docker compose build manager indexer
sudo docker compose up -d --force-recreate manager indexer
```

`.env`에는 AAH와 같은 `NODEMAILER_USER`, `NODEMAILER_PASS`, `ADMIN_NOTIFY_EMAIL`을 설정한다. 운영 `.env`와 개인키·토큰은 압축본에 포함되지 않는다. 적용 후 테스트 이메일로 신청·확인·지급 전체 흐름과 `/admin/trial-audience`의 관리자 권한 경계를 확인한다. 기대 Manager 버전은 `1.0.0.18`이다.

원격 작업은 `docs/VERSION_1.0.0.18_TRIAL_EMAIL_AUDIENCE.md`의 Draft PR → CI → 병합 → 태그 순서를 따른다.
