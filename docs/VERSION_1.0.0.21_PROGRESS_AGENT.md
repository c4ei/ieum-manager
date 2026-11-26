# IEUM Manager 1.0.0.21 · 진행 막대와 호스트 에이전트

## 진행 막대
- 처음 며칠은 적립이 0.001 IEUM 단위라 퍼센트가 0으로 보였습니다. 이제 `모은 담보 / 100 IEUM`과 `0.01% 미만`으로 표시하고 막대도 보이게 합니다.

## 사고 대응 호스트 에이전트 설치 순서
1. Manager `.env`에 32자 이상 무작위 `IEUM_RECOVERY_CONTROL_TOKEN`을 넣고 `docker compose up -d manager`.
2. `docker inspect`로 Manager의 `/app/control` 마운트 경로를 확인하고, 컨테이너 `ieum` 사용자가 쓸 수 있게 소유자를 맞춥니다.
3. `deploy/ieum-recovery-agent.sh`를 `/opt/ieum-manager/deploy/`에, 서비스·타이머를 `/etc/systemd/system/`에 설치합니다.
4. `/etc/ieum-manager-recovery.env`(권한 600)에 토큰, control 경로, 로그 경로, 노드 경로를 넣습니다.
5. 서비스가 `ProtectSystem=strict`이므로 drop-in으로 실제 control 경로를 `ReadWritePaths`에 추가합니다.
6. `systemctl enable --now ieum-recovery-agent.timer` 후 `/admin/incidents`에 `호스트 에이전트 연결됨`이 보이면 완료입니다.

되돌리기: `systemctl disable --now ieum-recovery-agent.timer`
