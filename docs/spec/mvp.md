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
