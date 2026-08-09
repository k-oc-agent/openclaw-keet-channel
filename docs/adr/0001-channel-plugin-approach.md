# ADR 0001: Keet Channel Plugin Approach

## Status

Accepted for MVP.

## Context

Keet integration should live as a community/ClawHub channel plugin, not in
OpenClaw core. The local K-OC bridge proves that Keet can be driven today via a
desktop/CDP bridge, but that prototype is operational evidence rather than the
final architecture.

OpenClaw channel plugins own platform config, security policy, session grammar,
native send/receive transport, health and lifecycle. OpenClaw core owns the
shared `message` tool, prompt wiring, generic session keys, queueing, and
dispatch.

## Decision

Build `Plak/openclaw-keet-channel` as a new OpenClaw external channel plugin.
The MVP uses a local bridge-CLI transport for outbound durable text only, with
explicit DM allowlist policy and no production group enablement by default.

Use the current Keet GUI/CDP bridge only as prototype/evidence. Do not migrate
its secrets, recovery material, or broad host-level scripts into this repo.

Native Pear/Holepunch transport remains a later milestone after the SDK and
security model are proven.

## Consequences

- The repo starts packageable and testable without requiring a live Keet secret.
- Stage tests can use a fake bridge command before any real Keet group is
  touched.
- Public/ClawHub release is blocked until pairing, identity, key storage,
  inbound dedupe, lifecycle and security review are complete.
- Core OpenClaw changes are out of scope unless the channel plugin SDK exposes a
  concrete blocker.

## Stop Criteria

Stop and return to spec if any of these appear:

- Keet/Pear requires recovery phrases or raw key material in plugin config.
- Sender identity cannot be verified before OpenClaw dispatch.
- Stage containment cannot prove no production group/session path is touched.
- The bridge transport requires shell execution or unbounded host writes.
