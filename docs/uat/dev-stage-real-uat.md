# Dev/Stage Real Keet UAT Matrix

Issue: `Plak/openclaw-keet-channel#17`

## Purpose

This matrix defines the reusable UAT gate for real Keet Dev/Stage testing. It
uses persistent non-production Keet identities so DM, group chat, reply,
inbound, restart and recovery behavior can be checked across releases without
using Plak's personal account or production Keet groups.

Fake bridge checks remain useful preflight tests for package and gateway
contracts. They do not replace these real Keet UATs when a release changes
inbound, reply, room selection, cursor, dedupe, group routing or recovery
behavior.

## Test Identities

Create and reuse these persistent identities:

- Dev pair: `k-oc-keet-dev-a`, `k-oc-keet-dev-b`
- Stage pair: `k-oc-keet-stage-a`, `k-oc-keet-stage-b`

Store operational recovery material only in OpenBao:

- `kv/data/openclaw/keet/dev/test-a`
- `kv/data/openclaw/keet/dev/test-b`
- `kv/data/openclaw/keet/stage/test-a`
- `kv/data/openclaw/keet/stage/test-b`

Each OpenBao entry should contain at least:

- `display_name`
- `username`
- `profile_path`
- `recovery_phrase`
- `backup_file_path`
- `backup_file_sha256`
- `backup_file_size_bytes`
- `backup_password`
- `source`

Do not store recovery phrases, backup passwords, invite links, QR payloads,
raw key material or raw message text in this repository, GitLab notes,
Discord, logs, package artifacts, OpenClaw plugin config or UAT evidence.

## Evidence Rules

For each UAT, record only redacted evidence:

- environment: Dev or Stage
- host identity and OpenClaw profile path
- package version, commit and archive sha256
- Keet profile paths and OpenBao paths, never secret values
- configured account ids and allowlists
- test chat names
- message ids, receipt ids, route keys, timestamps, text length and text hash
- health/readback status before and after the test
- rollback path and cleanup status

Production OpenClaw config, production Keet profiles, Plak's personal Keet DM
and production Keet groups remain out of scope unless Plak gives an explicit
production gate.

## UAT List

### Provisioning UATs

- `UAT-DEV-PROV-001`: Create or verify the two persistent Dev identities, their
  isolated profile paths and OpenBao entries.
- `UAT-STAGE-PROV-001`: Create or verify the two persistent Stage identities,
  their isolated profile paths and OpenBao entries.
- `UAT-DEV-PROV-002`: Prove Dev identities can be recovered from OpenBao-held
  recovery material in an isolated profile without exposing the secret value.
- `UAT-STAGE-PROV-002`: Prove Stage identities can be recovered from OpenBao-held
  recovery material in an isolated profile without exposing the secret value.

### DM UATs

- `UAT-DEV-DM-001`: Dev A sends a DM to Dev B through the bridge; Dev B receives
  it and the plugin records the expected direct route.
- `UAT-DEV-DM-002`: Dev B sends a DM to Dev A; Dev A receives it and no echo row
  is emitted as inbound.
- `UAT-STAGE-DM-001`: Stage A sends a DM to Stage B through the bridge; Stage B
  receives it and the plugin records the expected direct route.
- `UAT-STAGE-DM-002`: Stage B sends a DM to Stage A; Stage A receives it and no
  echo row is emitted as inbound.

### Reply UATs

- `UAT-DEV-REPLY-001`: Dev B replies natively to a Dev A message; poll returns
  the original message id as `replyToId` when Keet exposes the reply affordance.
- `UAT-DEV-REPLY-002`: Dev A sends an OpenClaw reply to a Dev B inbound event;
  bridge evidence shows whether `--reply-to` was preserved or explicitly absent.
- `UAT-STAGE-REPLY-001`: Stage B replies natively to a Stage A message; poll
  returns the original message id as `replyToId` when Keet exposes the reply
  affordance.
- `UAT-STAGE-REPLY-002`: Stage A sends an OpenClaw reply to a Stage B inbound
  event; bridge evidence shows whether `--reply-to` was preserved or explicitly
  absent.

### Group Chat UATs

- `UAT-DEV-GROUP-001`: Create or verify a persistent Dev test group containing
  Dev A and Dev B only; verify membership with `chat-info`.
- `UAT-DEV-GROUP-002`: Dev A sends a group message; Dev B receives it and the
  plugin emits the expected group route only when the group and sender are
  allowlisted.
- `UAT-DEV-GROUP-003`: Dev B replies in the group; Dev A receives it and no
  direct-chat route is accidentally selected.
- `UAT-DEV-GROUP-004`: Disable or remove the Dev group allowlist entry and
  prove the same group sender is rejected with a redacted reason.
- `UAT-STAGE-GROUP-001`: Create or verify a persistent Stage test group
  containing Stage A and Stage B only; verify membership with `chat-info`.
- `UAT-STAGE-GROUP-002`: Stage A sends a group message; Stage B receives it and
  the plugin emits the expected group route only when the group and sender are
  allowlisted.
- `UAT-STAGE-GROUP-003`: Stage B replies in the group; Stage A receives it and
  no direct-chat route is accidentally selected.
- `UAT-STAGE-GROUP-004`: Disable or remove the Stage group allowlist entry and
  prove the same group sender is rejected with a redacted reason.

### Restart And Recovery UATs

- `UAT-DEV-RECOVERY-001`: Restart the Dev OpenClaw gateway after a DM and group
  message; prove old messages are not replayed as new inbound events.
- `UAT-STAGE-RECOVERY-001`: Restart the Stage OpenClaw gateway after a DM and
  group message; prove old messages are not replayed as new inbound events.
- `UAT-DEV-RECOVERY-002`: Restart the Dev Keet client or bridge process and
  prove send, poll and health recover without touching production state.
- `UAT-STAGE-RECOVERY-002`: Restart the Stage Keet client or bridge process and
  prove send, poll and health recover without touching production state.

### Negative And Security UATs

- `UAT-DEV-NEG-001`: Unknown Dev direct sender is rejected when `dmPolicy` is
  `allowlist`.
- `UAT-STAGE-NEG-001`: Unknown Stage direct sender is rejected when `dmPolicy` is
  `allowlist`.
- `UAT-DEV-NEG-002`: Unconfigured Dev group is rejected by default.
- `UAT-STAGE-NEG-002`: Unconfigured Stage group is rejected by default.
- `UAT-SEC-001`: Scan repo, package and evidence for recovery phrases, backup
  passwords, invite links, QR payloads, raw key material and raw message text.
- `UAT-SEC-002`: Prove the recorded rollback path disables the non-production
  Keet account or group without deleting identity material.

## Extending The List

Add a new UAT whenever a release changes Keet-visible behavior or a live bug
reveals a missing coverage area. New entries must have a stable id, environment
scope, expected evidence, rollback note and explicit secret-handling statement.
