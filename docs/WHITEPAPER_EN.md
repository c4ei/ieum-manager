# IEUM Chain Whitepaper

Version 1.0 · 2026-08-25

IEUM is a public ledger built in Rust to connect everyday services with digital assets. It combines PoS participation, BFT finality, Ethereum-style addresses and JSON-RPC, QUIC-based P2P networking, independent-node verification, and a public explorer in one operable system.

## Verifiable core specifications

- Mainnet Chain ID: `21004`
- Consensus: weighted-validator proposal → prevote → precommit BFT
- Finality evidence: signed certificate backed by more than two-thirds of voting power
- Minimum target interval accepted by the implementation: `100 ms–15 s`; default `5 s`
- Whitepaper operating profile: `100 ms–5 s`
- Accounts/units: 0x accounts, secp256k1 signatures, 18 decimals (`1 IEUM = 10^18 wei`)
- Network: libp2p/QUIC, persistent Peer IDs, direct sync, certified snapshots/checkpoints

The 100 ms value is a configurable minimum target, not a throughput or time-to-finality guarantee. Observed results depend on validator count, consensus timeouts, network latency, and load.

## Design principles

IEUM learns from familiar Ethereum/geth address, signature, and JSON-RPC conventions; Solana's focus on latency-aware user experience; and the explicit proposal, prevote, precommit, and greater-than-two-thirds commit pattern documented by Cosmos/CometBFT. IEUM is an independent implementation. It does not claim Ethereum's security scale or full EVM equivalence, Solana-equivalent throughput, or Cosmos SDK/IBC support.

## Economics and transparency

IEUM supports value transfer, network fees, PoS validator participation and consensus rewards, and connections to AAH service experiences. The explorer reads total issued, circulating, and locked balances from chain RPC. Maximum supply, treasury allocations, lockups, and reward policies should follow versioned on-chain configuration and public policy.

Price appreciation, principal, liquidity, and continuing rewards are not guaranteed. This document is not investment advice.

## Security and disclosed risks

Validator, node identity, and user keys are separated. Independent RPC quorum, BFT certificates, snapshot signatures, and genesis/version consistency checks are used. The public Manager is read-only. Concentrated early validator membership, limited production history, the need for external security audits, and market, regulatory, and liquidity uncertainty remain disclosed risks.

## Roadmap

1. Expand automated failure, rejoin, restart, and signed-transaction E2E validation.
2. Publish validator entry and rotation procedures, concentration, and performance metrics.
3. Strengthen external audits, threat modeling, bug bounty, and responsible disclosure.
4. Connect Wallet, Cold Wallet, Explorer, and real-world use cases.

## Open source

- [IEUM Chain](https://github.com/c4ei/ieum-chain)
- [IEUM Wallet](https://github.com/c4ei/ieum-wallet)
- [IEUM Cold Wallet](https://github.com/c4ei/ieum-cold-wallet)
- [IEUM Manager](https://github.com/c4ei/ieum-manager)

## Technical references

- [Ethereum.org — Proof of Stake](https://ethereum.org/developers/docs/consensus-mechanisms/pos/)
- [Solana Docs — Transactions](https://solana.com/docs/core/transactions)
- [Cosmos Docs — CometBFT Specification](https://docs.cosmos.network/cometbft/latest/spec/CometBFT-Spec)
