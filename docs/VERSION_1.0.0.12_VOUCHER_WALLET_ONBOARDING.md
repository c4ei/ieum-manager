# IEUM Manager v1.0.0.12 — 상품권 수령 Wallet 설치 안내

## 사용자 흐름

QR로 상품권에 접속한 사용자는 먼저 두 경로 중 하나를 선택합니다.

- **지갑이 있어요**: 받을 IEUM 주소 입력 영역으로 이동
- **지갑이 없어요**: 현재 기기 감지와 Wallet 설치 안내 표시

기기 자동 감지는 추천 화면을 먼저 보여주기 위한 용도이며 사용자가 Windows, macOS, Ubuntu/Linux, 휴대전화를 직접 다시 선택할 수 있습니다.

## 운영체제별 안내

- Windows: 공식 Light Wallet의 NSIS `.exe` 또는 MSI
- macOS: Apple Silicon 또는 Intel용 DMG
- Ubuntu/Linux: Ubuntu DEB, 기타 배포판 AppImage
- Android/iPhone: 일반 사용자용 모바일 Wallet 배포가 확정되지 않아 PC Wallet 설치 후 주소를 복사하도록 안내

2026-08-27 GitHub 저장소 확인 기준 Wallet 표시 버전은 `1.0.2.1`이며, 빌드 워크플로는 Windows NSIS/MSI, Ubuntu AppImage/DEB, macOS Intel/Apple Silicon DMG를 생성합니다. 설치 링크는 개별 자산명을 고정하지 않고 다음 공식 최신 릴리스 페이지를 사용합니다.

```text
https://github.com/c4ei/ieum-wallet/releases/tag/wallet-light-latest
https://github.com/c4ei/ieum-wallet/releases/tag/wallet-normal-latest
```

릴리스 자산 파일명이 변경돼도 링크가 깨지지 않습니다.

## 모바일 사용자 매뉴얼

1. 휴대전화로 상품권 앞면 QR을 찍습니다.
2. 금액과 사용 가능 상태를 확인합니다.
3. **지갑이 없어요**에서 상품권 링크를 복사해 안전하게 보관합니다.
4. Windows, macOS 또는 Ubuntu/Linux PC에 공식 IEUM Wallet을 설치합니다.
5. Wallet에서 새 지갑을 만들고 복구 정보를 안전하게 백업합니다.
6. Wallet의 `0x…` 받기 주소를 복사합니다.
7. 휴대전화의 상품권 화면으로 돌아와 받기 주소와 뒷면 교환번호를 입력합니다.
8. 지급 완료 후 Explorer 거래 링크를 확인합니다.

상품권 URL에는 비밀 토큰이 포함되므로 교환번호와 함께 다른 사람에게 전달하면 안 됩니다. 수령 화면은 지갑 비밀번호, 복구 문구, 개인키를 요구하지 않습니다.

## Ubuntu 안내

일반 사용자는 GitHub Releases의 `.deb` 또는 `.AppImage`를 설치합니다. `npm run tauri dev`는 Node.js·Rust·Tauri 개발 환경이 준비된 개발자만 사용하도록 접힌 별도 영역에 배치했습니다.

```bash
git clone https://github.com/c4ei/ieum-wallet.git
cd ieum-wallet
npm ci
npm run tauri dev
```

## 배포

Manager 화면만 변경합니다. DB 마이그레이션과 새 Docker 환경변수는 없습니다. v1.0.0.9의 기존 환경변수를 유지합니다.

```bash
cd ~/www/ieum-manager_8787
sudo docker compose config --quiet
sudo docker compose build --no-cache manager indexer
sudo docker compose up -d --force-recreate manager indexer
sudo docker compose ps
sudo docker compose logs --tail=100 manager indexer
```

## 배포 후 확인

1. 휴대전화와 PC에서 새 상품권 QR을 엽니다.
2. 휴대전화에서는 설치 안내가 자동으로 펼쳐지는지 확인합니다.
3. PC에서는 감지된 운영체제가 선택되는지 확인합니다.
4. 모든 운영체제 버튼과 공식 Light/Normal 링크를 확인합니다.
5. **지갑이 있어요**가 받을 주소 입력으로 이동하는지 확인합니다.
6. **이 상품권 링크 복사** 후 같은 상품권으로 돌아올 수 있는지 확인합니다.
7. 지급 과정과 일회성 사용 방지가 이전과 동일하게 동작하는지 소액으로 확인합니다.

## 검증

```bash
npm ci
npm test
node --check public/voucher.js
sudo docker compose config --quiet
sudo docker compose build manager indexer
```

## Git·PR·태그 절차

표시 버전은 `1.0.0.12`, 내부 SemVer는 `1.0.0-12`입니다.

```bash
git switch -c feature/v1.0.0.12-voucher-wallet-guide
git status --short
git add -- CHANGELOG.md README.md package.json package-lock.json \
  public/voucher.html public/voucher.js public/voucher-onboarding.css \
  test/server.test.js test/voucher-onboarding.test.js \
  docs/VERSION_1.0.0.12_VOUCHER_WALLET_ONBOARDING.md
git commit -m "feat: guide voucher recipients through wallet setup"
git push -u origin feature/v1.0.0.12-voucher-wallet-guide
gh pr create --base main --head feature/v1.0.0.12-voucher-wallet-guide --draft \
  --title "IEUM Manager v1.0.0.12 상품권 Wallet 설치 안내" \
  --body "기기별 Wallet 설치와 모바일에서 PC 주소를 준비하는 수령 흐름을 추가합니다."
```

Manager 태그 제외 정책이면 태그는 만들지 않습니다. 필요한 경우에만 PR 병합과 CI 성공 후 `v1.0.0.12` 태그를 생성합니다.

git switch main
git pull --ff-only origin main
git tag -a v1.0.0.12 -m "IEUM Manager v1.0.0.12"
git push origin v1.0.0.12
