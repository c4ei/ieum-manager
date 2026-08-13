# IEUM Manager v0.3.4 — AAH 생태계 연결

작성일: 2026-08-13

## 현재 버전

- IEUM Manager: v0.3.4
- 기준 소스: c4ei/ieum-manager main 브랜치의 v0.3.3

## 작업 내용

- 운영 관제 헤더 아래에 AAH 생태계 홍보 배너를 추가했습니다.
- https://aah.name 서비스 시작 동선과 https://cex.aah.name CEX 확인 동선을 분리했습니다.
- 외부 링크에 새 창 및 noopener noreferrer 보안 속성을 적용했습니다.
- 모바일에서 버튼이 한 열로 정렬되도록 반응형 스타일을 추가했습니다.
- 검색 노출을 위한 한국어 페이지 설명 메타 태그를 추가했습니다.
- 화면 하단 버전 표기를 v0.3.4로 정정했습니다.

## 적용 파일

- public/index.html
- public/ieum-promo.css
- package.json
- package-lock.json
- docs/IEUM_Manager_v0.3.4_AAH_Ecosystem_변경내역.md

## 추가로 필요한 작업

1. 운영 배포 후 aah.name, cex.aah.name 링크와 모바일 레이아웃을 확인합니다.
2. CEX가 IEUM 입출금 또는 거래를 공식 지원하는 시점에 마켓명과 지원 상태를 배너에 명시합니다.
3. 공개 페이지라면 운영 관제의 민감 정보 노출 범위를 다시 점검합니다.

## 적용 예시

    tar -xJf ieum-manager_v0.3.4_aah-promo_changed-only.tar.xz -C /opt/ieum-manager
    cd /opt/ieum-manager
    npm test
    sudo systemctl restart ieum-manager
