# IEUM Manager v0.3.22 — Chain Doctor와 제한된 복구

`https://iem.aah.name/admin.html`에서 관리자 인증 후 네 노드의 버전, Genesis, 높이,
피어와 대기 거래를 한 화면에서 점검할 수 있습니다. 대기 거래가 있는데 높이가 20초
이상 그대로이면 위험으로 표시합니다.

## 안전한 설치

Manager 컨테이너에 Docker 소켓을 연결하지 않습니다. 웹은 공유 폴더에 서명 토큰이
포함된 요청 파일만 만들고, 같은 서버의 작은 systemd 에이전트가 요청을 검증한 뒤
`ieum-node1`~`ieum-node4`만 재시작합니다.

```bash
sudo install -d -m 700 /var/lib/ieum-manager-control /var/log/ieum-recovery
openssl rand -hex 32
```

출력값을 `.env`와 `/etc/ieum-manager-recovery.env`에 동일하게 설정합니다.

```text
IEUM_RECOVERY_CONTROL_TOKEN=64자리_임의값
IEUM_RECOVERY_CONTROL_HOST_DIR=/var/lib/ieum-manager-control
IEUM_RECOVERY_LOG_DIR=/var/log/ieum-recovery
```

```bash
sudo install -m 755 deploy/ieum-recovery-agent.sh /opt/ieum-manager/deploy/
sudo install -m 644 deploy/ieum-recovery-agent.service deploy/ieum-recovery-agent.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ieum-recovery-agent.timer
docker compose up -d --build manager indexer
```

복구 버튼은 진단 결과가 위험일 때만 활성화됩니다. 대기 거래 유실 가능성 체크와
`RESTART IEUM NODES` 확인 문구가 모두 필요합니다. 재시작 직전 로그는
`/var/log/ieum-recovery`에 보존됩니다. 자동 업데이트나 데이터 삭제는 수행하지 않습니다.
