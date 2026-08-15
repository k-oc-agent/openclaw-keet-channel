# Changelog

## 0.1.18

- Reuse a recent visible outgoing target-room row before retrying the same
  normal bridge send, preventing OpenClaw delivery retries after a post-send
  room-mismatch failure from posting identical Keet DM text twice.

## 0.1.17

- Treat Keet Desktop `Forward` / `Forward Message` menu entries as explicit
  unsupported actions during reply-target selection, so `send --reply-to`
  fails with a Forward-specific error instead of silently downgrading to a
  normal send or mixing Forward into the native Reply path.

## 0.1.16

- Suppress duplicate Keet text sends to the same target/reply id inside a short
  idempotency window, preventing message-tool plus runtime-final paths from
  double-posting the same visible DM reply.
- Reject internal OpenClaw status/progress text such as `Model Fallback:` before
  it can reach Keet Desktop as a human-visible message.

## 0.1.15

- Require fresh DM and Canary production processing smokes before a prod gate can
  be called green: inbound message id, route/session proof, visible reply
  receipt, target-room readback, wrong-room absence and response hash.
- Fail UAT evidence when OpenClaw processing is only proven by bridge-poll,
  parser readback or a generic/wrong-scope response.

## 0.1.14

- Retry Keet Desktop post-send DOM readback and accept a target-room text match
  when Keet delays the outgoing-direction marker, preventing false
  `OutboundDeliveryError` results after a successful send.
- Preserve the existing target-room safety checks before and after send.

## 0.1.13

- Fail `send --reply-to` closed when Keet Desktop did not actually select a
  native reply target, preventing a quote-reply request from silently becoming a
  normal message.
- Require Dev/Stage UAT evidence to prove native quote/reply structure,
  target-room readback and wrong-room absence before quote-reply smokes can pass.

## 0.1.12

- Select Keet native Reply from the message `...` menu when the desktop client
  exposes quote reply there instead of as a direct hover button.
- Keep target-room verification before reply selection, before composer focus
  and after send.

## 0.1.11

- Read the actual body from native Keet reply rows instead of the quoted parent
  message, so replies quoting `K OpenClaw` are no longer dropped as echoes.
- Preserve the existing OpenClaw echo filter for rows that contain only an
  OpenClaw quote/echo and no user-authored body.

## 0.1.10

- Fail Keet Desktop CDP sends closed when the selected sidebar room no longer
  matches the requested target before reply selection, before composer focus or
  after send.
- Tie send readback to the verified active target room so a send cannot be
  reported successful from a stale or wrong-room DOM context.

## 0.1.9

- Preserve OpenClaw reply context for Keet text sends by declaring `replyTo`
  support and forwarding `replyToId` through the message adapter, gateway
  inbound reply path and bridge CLI.
- Extend the fake bridge and Keet Desktop CDP bridge contract with
  `send --reply-to <message-id>` evidence.

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
