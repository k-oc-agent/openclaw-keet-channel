# ADR 0002: Keet Transport Strategy

## Status

Accepted

## Context

The MVP already has a narrow bridge-CLI transport that can be installed in the
OpenClaw `stage` profile without configuring a real Keet account. The next
question is whether the plugin should replace that bridge with direct
Pear/Holepunch integration.

Upstream Pear documentation describes Pear as an application runtime for P2P
apps, with Bare workers and modules such as Hyperswarm, Hypercore and
pear-runtime. The official peer-to-peer chat guide shows how to build a new
chat-like app on a public DHT topic using Hyperswarm and Bare IPC. The docs do
not expose a stable public API for automating the installed Keet app's real chat
database, contacts, rooms, or identity lifecycle from an OpenClaw plugin.

The local K-OC bridge already works through the installed Keet desktop session
and can be isolated behind an argv-only CLI boundary. That boundary is easier to
test, allowlist, fake in Stage, and eventually replace behind the same transport
interface.

## Decision

Keep the bridge-CLI transport as the supported MVP and near-term production
path. Do not implement direct Pear/Holepunch transport against production Keet
state now.

Direct Pear/Holepunch work is allowed only as a separate throwaway Dev spike
with isolated storage and throwaway identity. It must not import recovery
phrases, touch production Keet groups, or become the production transport until
the stop criteria below are cleared.

## Stop Criteria for Direct Transport

- No documented, stable API for the installed Keet app's chat/session model.
- Any requirement to read, derive, import, export, or persist Keet recovery
  phrases or raw identity seed material inside the plugin.
- Sender identity is peer-provided instead of cryptographically bound to a
  configured peer key and local allowlist decision.
- Inbound dedupe requires persisting message text instead of ids, timestamps,
  hashes, and route metadata.
- Lifecycle cannot be cleanly mapped to `startAccount`, `stopAccount`, health,
  and bounded reconnect behavior.
- The transport needs a browser/CDP session or production desktop UI automation
  to be considered "native".

## Consequences

- Production can ship a conservative outbound channel plugin once allowlist,
  config and operational gates are complete.
- The local bridge remains the replaceable seam for real Keet integration.
- Native Pear/Holepunch investigation continues as an isolated research track,
  focused on protocol viability and identity, not on controlling the installed
  Keet app.

## References

- Pear docs: https://docs.pears.com/
- Pear peer-to-peer chat guide:
  https://docs.pears.com/getting-started/build-a-peer-to-peer-chat/build-a-peer-to-peer-chat/
- Pear runtime reference: https://docs.pears.com/reference/pear/runtime/
- Hyperswarm reference: https://github.com/holepunchto/hyperswarm
- Prior WIP review:
  `docs/security/external-wip-review-2026-08-09.md`
