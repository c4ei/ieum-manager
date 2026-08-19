# IEUM Manager v0.3.19 — 보상 이벤트 관리자

- `/admin/rewards`에서 기간형 보유 보상과 최초 참여 보상 이벤트를 생성한다.
- 취소 이벤트를 제외한 모든 이벤트는 기간 중복을 거부한다.
- 보유 보상은 APR 0~50%, 최소 보유량, 일일 지급 상한을 검증한다.
- 활성 보유 이벤트는 하나만 허용하며 Chain용 `holder-rewards.json` 값을 API로 반환한다.
- Chain `ieum_holderRewardHistory`에서 확정 지급 주소·금액·시각·블록을 표시한다.
- 지갑 생성, 첫 송금, 노드 24시간, 오류 신고, SNS 후기의 기본 참여 보상을 포함한다.
- SNS 후기 보상은 0.01 IEUM으로 고정하고 AAH 계정·지갑·SNS 계정·게시물 URL별
  1회 중복 검사를 적용한다.
- SNS 신청/본인 조회 API와 관리자 승인·거절 대기열을 제공한다. 최대 공급량을
  강제하는 합의 발행 기능 전에는 실제 자동 발행하지 않는다.
- `IEUM_SNS_VERIFY_URL`과 `IEUM_SNS_VERIFY_TOKEN`을 설정하면 고정된 HTTPS 검증
  서비스가 게시물·계정 소유를 확인한 신청만 자동 승인한다. 미설정 또는 확인 실패는
  관리자 검토 대기 상태로 남긴다.
- 수동 지급은 주소·금액·거래 hash를 검증한 뒤 최대 10,000건을 감사 상태에 기록한다.
- 온체인 지급에는 IP·국가를 기록하지 않는다. 별도 신청에서 수집한 값만 관리자 기록에
  제한적으로 남길 수 있으며 개인정보 동의와 보존기한이 별도로 필요하다.

중요: Manager의 활성 버튼은 배포 승인 상태를 만든다. 검증자 서버에 직접 접속하거나
개인키를 보유하지 않는다. 반환 설정을 모든 검증자에 동일 배포하고 정책 hash를 확인한
뒤 재시작해야 Chain 지급이 실제로 시작된다.

```bash
npm ci
npm test
docker compose config
docker compose build manager indexer
```

```bash
git switch dev
git add package.json package-lock.json server.js lib public test docs README.md config.example.json
git commit -m "feat: add reward campaign admin v0.3.19"
git push origin dev
gh pr create --base main --head dev --title "IEUM Manager v0.3.19 reward campaigns" --draft
```
