# Changelog

## 0.1.8

- Route gateway-native Keet inbound deliveries through the OpenClaw channel
  runtime turn runner when available, keeping the legacy reply dispatcher only
  as a compatibility fallback.
- Fail CDP polling when Keet Desktop did not activate the requested sidebar
  room before message extraction, preventing direct/group room mixups.

## 0.1.7

- Make the repo-owned Keet Desktop CDP bridge candidate match the current
  plugin polling contract: `poll --account ... --limit ...` derives enabled
  direct and group targets from the local bridge config instead of requiring
  `--chat`.
- Resolve bare send targets such as `plak0815` to configured Keet sidebar chat
  names before opening Keet Desktop.
- Prefer Keet sidebar room-list entries when opening a chat to avoid selecting
  matching sender text inside the active message history.

## 0.1.6

- Add a repo-owned Keet Desktop CDP bridge candidate for internal Dev/Stage
  proofing.
- Keep polling idempotent when Keet exposes only a virtualized visible message
  window by relying on persisted message-id dedupe instead of DOM index cursors.
- Filter visible `K OpenClaw` echo rows before they can be emitted as inbound
  Keet events.

## 0.1.5

- Persist the gateway poll cursor and dedupe keys when `stateDir` is configured.
- Prevent old Keet rows from being replayed as fresh inbound turns after a
  gateway restart, client restart, or emergency recovery.
- Persistent state remains redacted: raw message text is not written.

## 0.1.4

- Re-publish the `0.1.3` Keet target resolver fix after ClawHub reserved
  `0.1.3` without making it visible or installable.
- No runtime code change from `0.1.3`.

## 0.1.3

- Resolve Keet message targets through the OpenClaw messaging adapter.
- Support bare allowlisted handles, explicit Keet direct targets, group targets
  and OpenClaw runtime direct-session locators.

## 0.1.2

- Reject foreign OpenClaw channel locators before invoking the Keet bridge.
- Document the corrected Dev/Stage gateway lifecycle proof for the current
  release state.
- Keep `0.1.1` as the gateway-native lifecycle baseline and use `0.1.2` for
  the target-guarded internal release.

## 0.1.1

- Add gateway-native Keet account lifecycle with bridge polling.
- Dispatch allowlisted inbound Keet events through the OpenClaw channel
  runtime instead of relying only on the external timer bridge.
- Report runtime health/activity from the plugin account lifecycle.

## 0.1.0

- Add OpenClaw channel plugin metadata for Keet.
- Add bridge-CLI outbound send transport.
- Add bridge-CLI inbound poll transport.
- Add allowlist-first inbound routing, dedupe and redacted state records.
- Document public bridge contract, security boundary and rollback path.
