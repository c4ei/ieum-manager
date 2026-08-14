# IEUM Manager v0.3.11 AAH JWT·메뉴 분리

AAH 로그인 쿠키 `token`은 운영에서 `.aah.name` 도메인으로 공유됩니다. Manager는 AAH와 같은 `JWT_SECRET`으로 JWT 서명과 만료를 검증하고 `userType=A`인 경우에만 관리자 API를 허용합니다. Manager는 JWT를 발급하거나 AAH 사용자 DB를 조회하지 않습니다.

관리자 URL은 `/admin/dashboard`, `/admin/rpc`, `/admin/waf`, `/admin/blocked`, `/admin/audit`로 분리했습니다. 기존 `/admin.html`도 비상 접근을 위해 유지합니다.

공개 상세 URL은 `/nodes`, `/validators`, `/accounts`, `/transactions`, `/explorer`이며 상세 목록은 25개 단위로 페이지 처리합니다. 메인 화면은 요약 대시보드로 유지합니다.

LIVE NETWORK 시각은 브라우저에서 매초 변경하고 실제 RPC snapshot은 5초마다 갱신합니다.
