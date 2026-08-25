# IEUM Chain 백서

버전 1.0 · 2026-08-25

IEUM은 일상 서비스와 디지털 자산을 연결하기 위해 Rust로 구축한 공개 원장이다. PoS 참여, BFT 최종성, Ethereum 계열 주소와 JSON-RPC, QUIC 기반 P2P, 독립 노드 검증 및 공개 Explorer를 하나의 운영 가능한 체계로 제공한다.

## 검증 가능한 핵심 사양

- 메인넷 Chain ID: `21004`
- 합의: 가중 검증자 집합의 proposal → prevote → precommit BFT
- 확정 기준: 2/3 초과 투표권의 서명 인증서
- 블록 최소 목표 간격: 코드상 `100ms~15초`, 기본 `5초`
- 백서 운영 프로파일: `100ms~5초`
- 계정/단위: 0x 계정, secp256k1 서명, 18 decimals (`1 IEUM = 10^18 wei`)
- 네트워크: libp2p/QUIC, 영구 Peer ID, 직접 동기화, 인증 snapshot/checkpoint

100ms는 설정 가능한 최소 목표값이며 실제 처리량이나 최종확정 시간의 보장이 아니다. 실제 결과는 검증자 수, 합의 타임아웃, 네트워크 지연과 부하에 좌우된다.

## 설계 원칙

IEUM은 Ethereum/geth 생태계에서 익숙한 주소·서명·JSON-RPC 관습, Solana가 강조하는 낮은 지연의 사용자 경험, Cosmos/CometBFT의 명시적인 proposal·prevote·precommit 및 2/3 초과 커밋 원칙을 참고한다. IEUM은 독립 구현이며 Ethereum과 같은 보안 규모, 완전한 EVM 호환, Solana와 동일한 처리량, Cosmos SDK 또는 IBC 지원을 주장하지 않는다.

## 경제와 투명성

IEUM은 가치 이전, 네트워크 수수료, PoS 검증자 참여와 합의 보상, AAH 서비스 경험 연결에 사용된다. Explorer는 총 발행량, 유통량, 잠금 잔액을 체인 RPC에서 조회한다. 최대 공급, 재단 배분, 락업과 보상 정책은 버전이 있는 온체인 설정 및 공개 정책을 기준으로 해야 한다.

가격 상승, 원금, 유동성 또는 보상 지속성을 보장하지 않는다. 이 문서는 투자 권유가 아니다.

## 보안과 공개 위험

검증자 키, 노드 신원 키와 사용자 키를 분리한다. 독립 RPC quorum, BFT 인증서, snapshot 서명과 genesis/버전 일치 검사를 사용한다. 공개 Manager는 읽기 전용으로 운영한다. 초기 검증자 집합의 집중도, 제한된 실전 이력, 외부 보안 감사 필요성 및 시장·규제·유동성 불확실성은 공개 위험이다.

## 로드맵

1. 장애·재합류·재시작·정상 서명 거래 E2E 자동검증 확대
2. 검증자 참여·교체 절차와 집중도·성능 지표 공개
3. 외부 감사, 위협 모델, 버그바운티와 책임 있는 공개 강화
4. Wallet, Cold Wallet, Explorer와 실제 사용처 연결

## 공개 소스

- [IEUM Chain](https://github.com/c4ei/ieum-chain)
- [IEUM Wallet](https://github.com/c4ei/ieum-wallet)
- [IEUM Cold Wallet](https://github.com/c4ei/ieum-cold-wallet)
- [IEUM Manager](https://github.com/c4ei/ieum-manager)

## 기술 참고

- [Ethereum.org — Proof of Stake](https://ethereum.org/developers/docs/consensus-mechanisms/pos/)
- [Solana Docs — Transactions](https://solana.com/docs/core/transactions)
- [Cosmos Docs — CometBFT Specification](https://docs.cosmos.network/cometbft/latest/spec/CometBFT-Spec)
