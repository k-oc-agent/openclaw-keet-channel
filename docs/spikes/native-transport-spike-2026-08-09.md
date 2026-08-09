# Native Pear/Holepunch Transport Spike - 2026-08-09

Issue: `Plak/openclaw-keet-channel#3`

## Goal

Decide whether the Keet channel plugin should move from the bridge-CLI MVP to a
direct Pear/Holepunch transport.

## Research Readback

Pear is a P2P application runtime built around a runtime binary, Bare workers,
Pear CLI, Pear runtime, application storage and P2P modules. The docs describe
building new P2P apps and chats with Hyperswarm, Bare IPC and topics.

Hyperswarm provides E2E-encrypted duplex streams for peers on a 32-byte topic or
known peer public key. It does not by itself provide Keet's application-level
room membership, message history, contact identity, moderation, invites, or UI
state.

The public docs found for Pear/Holepunch are enough to build a new P2P chat-like
transport. They are not enough to safely automate the installed Keet app's real
chat data model as an OpenClaw production channel.

## Local Inputs

- Current repo bridge transport executes an argv array and parses JSON receipts.
- Stage proof in `docs/proofs/stage-install-proof-2026-08-09.md` showed the
  package loads as channel `keet` while remaining unconfigured/disabled.
- The K-OC local bridge currently uses a desktop Keet CDP driver plus Python
  routing/allowlist state. It is not native, but it has a real installed Keet
  session boundary and can be wrapped behind a hardened CLI.
- The two external WIP repos remain unsuitable for wholesale reuse per
  `docs/security/external-wip-review-2026-08-09.md`.

## Decision

No-go for direct native Pear/Holepunch production transport in this milestone.
Continue with the bridge-CLI transport as the supported MVP path.

## Threat Model

- Secret exposure: Keet recovery phrases, mnemonic identity seeds and raw key
  material must stay out of repo, chat, logs, issue comments and plugin state.
- Identity spoofing: inbound sender names or peer-provided ids cannot be trusted
  unless bound to configured keys and an allowlist decision.
- State leakage: message text must not be persisted in plugin state; only route
  metadata, message ids, hashes and timestamps are acceptable.
- UI automation fragility: CDP/browser automation is acceptable as a local
  bridge backend during development, but not as a claim of native transport.
- Network behavior: direct P2P experiments must use throwaway topics, isolated
  storage and bounded lifecycle; no production group or direct peer can be used
  without a later gate.

## Later Dev Prototype Boundaries

A future prototype may create two isolated local Pear/Hyperswarm workers with
throwaway storage and exchange one message over a random 32-byte topic. That
would prove module viability, not Keet compatibility. It must not import Keet
identity, inspect the installed Keet profile, or reuse production bridge state.

## Acceptance Mapping

- ADR update: `docs/adr/0002-transport-strategy.md`
- Threat model: this document
- Prototype/no-go: explicit no-go for production direct transport; later
  throwaway module prototype is scoped separately
- Stop criteria: recorded in ADR 0002
