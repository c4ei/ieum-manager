# IEUM Manager v0.3.8 CI 환경변수 버그 픽스

## 작업 배경

GitHub Actions에서 `npm test` 5개는 모두 통과했으나, `docker compose config` 단계가 다음 오류로 실패했습니다.

```text
required variable POSTGRES_PASSWORD is missing a value
```

운영용 `.env`는 보안상 Git 저장소에 포함하지 않는 것이 정상입니다. 따라서 CI 구성 검증에만 쓰이는 임시 값을 워크플로 환경변수로 제공합니다.

## 변경 내용

- 버전을 `0.3.7`에서 `0.3.8`로 변경했습니다.
- `.github/workflows/ci.yml`의 Compose 검증 단계에 `POSTGRES_PASSWORD=ci-only-placeholder`를 지정했습니다.
- 테스트용 값은 `docker compose config`의 변수 치환 검증에만 사용되며 컨테이너나 데이터베이스를 실행하지 않습니다.
- 실제 운영 비밀번호와 GitHub Actions Secret은 사용하지 않습니다.

## 운영 영향

- Manager, Indexer 및 PostgreSQL의 런타임 동작에는 변경이 없습니다.
- 운영 서버의 기존 `.env`는 수정하거나 교체하지 않습니다.
- 운영 배포 시에는 계속 강력한 실제 `POSTGRES_PASSWORD`를 `.env`에 설정해야 합니다.

## 적용 및 확인

```bash
tar -xJf ieum-manager-v0.3.8-changed-files.tar.xz
cp -a ieum-manager-v0.3.8/. /path/to/ieum-manager/
cd /path/to/ieum-manager
npm ci
npm test
POSTGRES_PASSWORD=ci-only-placeholder docker compose config >/dev/null
```

커밋 후 GitHub Actions의 `IEUM Manager CI`가 통과하는지 확인합니다.

## 변경 파일

- `.github/workflows/ci.yml`
- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `docs/IEUM_Manager_v0.3.8_CI_Env_버그픽스.md`
