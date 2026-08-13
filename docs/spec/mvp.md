# Keet Channel Plugin MVP Spec

## Goal

Provide a minimal, packageable OpenClaw Keet channel plugin that can be tested
on Dev/Stage without touching production Keet groups.

## MVP Requirements

- Register channel id `keet` through `defineChannelPluginEntry`.
- Declare channel metadata and manifest `channelConfigs`.
- Resolve one or more configured accounts under `channels.keet.accounts`.
- Enforce conservative DM policy:
  - default `dmPolicy` is `pairing`
  - `open` requires explicit `allowFrom: ["*"]`
  - production groups require later explicit gate
- Send durable final text through a local bridge CLI using argv arrays, never a
  shell command string.
- Return OpenClaw `MessageReceipt` values with platform message ids.
- Avoid storing message text in persistent plugin state.
- Persist bridge-poll cursor and bounded dedupe keys under `stateDir` when
  configured, so restarts do not replay old UI rows as new inbound turns.

## Non-Goals

- Native Pear/Holepunch transport.
- Keet recovery phrase import/export.
- Productive group allow-all behavior.
- Media, polls, reactions, edit/delete, live preview, typing indicators.
- Core OpenClaw changes unless SDK blockers are proven.

## Stage Acceptance

- Unit tests green.
- `npm pack` includes `dist/`, manifest and README.
- Local plugin install proof with fake bridge command.
- Stage outbound text smoke to a non-production Keet test chat.
- No production channel config, thread binding, cron, session, or Keet group is
  touched during Stage proof.

## Dev/Stage Coordination

- Dev is the disposable install/prototype target.
- Stage must use a dedicated Keet test chat and fake/throwaway bridge state
  until Plak explicitly approves a real group target.
- Any Stage smoke must record host identity, config path, plugin package hash,
  target chat id/name, and proof that production Keet groups were not used.

## Inbound Event Flow

Inbound support is designed but not enabled for production until a later bridge
backend can provide stable message ids and sender ids.

1. A bridge backend emits a normalized `KeetInboundEvent` with account id, chat
   type, conversation id, sender id, message id, timestamp and transient text.
2. The plugin resolves `channels.keet.accounts.<account>`.
3. Direct messages are allowed only by DM policy:
   - `disabled` rejects all.
   - `pairing` rejects until an explicit pairing flow exists.
   - `allowlist` accepts only `allowFrom` senders.
   - `open` is valid only when `allowFrom` explicitly contains `*`.
4. Group messages are rejected unless `groups.<conversationId>` exists, is
   enabled, and allowlists the sender or uses `allowFrom: ["*"]`.
5. Accepted events map to stable OpenClaw session keys:
   - direct: `channel:keet:<account>:direct:<conversation>`
   - group: `channel:keet:<account>:group:<conversation>`
6. Dedupe/pending state stores message id, route metadata, timestamp, text hash
   and text length. It must not persist raw message text.

## Gateway Lifecycle

The future account lifecycle should map cleanly onto OpenClaw channel account
operations:

- `startAccount`: validate bridge command/config, start or connect to the local
  bridge backend, load cursor/dedupe state and report health.
- `stopAccount`: stop polling/subscriptions, flush non-text state, close bridge
  handles and leave Keet desktop/app state untouched.
- health: configured/enabled state, bridge reachability, last receive cursor,
  last send receipt and explicit degraded reasons.
- rollback: disable `channels.keet.accounts.<account>.enabled` or uninstall the
  plugin from the non-production profile; do not delete Keet identity material.

Production groups remain blocked until sender identity, allowlist policy and
real bridge lifecycle are reviewed against this spec.
