# Release Notes and Rollback

## 0.1.13 Scope

- Fails `send --reply-to` closed if Keet Desktop did not actually select a
  native reply target, so quote-reply requests cannot silently become normal
  messages.
- Requires quote-reply UAT evidence to prove native quote structure, target-room
  readback and wrong-room absence before Dev/Stage gates can pass.

## 0.1.12 Scope

- Fixes Keet Desktop native reply selection when the client exposes `Reply`
  only through the message `...` action menu.
- Keeps the `0.1.10` target-room fail-closed checks before menu selection,
  before composer focus and after send.

## 0.1.11 Scope

- Fixes inbound parsing for Keet native replies where the first
  `.chat-message__text` belongs to the quoted parent message.
- Emits the user-authored reply body while keeping pure `K OpenClaw` echo rows
  filtered out.

## 0.1.10 Scope

- Hardens the Keet Desktop CDP bridge send path after a production smoke found
  that a DM-targeted send could be delivered to the active Canary group room.
- Fails closed unless the selected sidebar room matches the requested target
  before reply selection, before composer focus and after the send.
- Reads the outgoing message id only from the verified target room after send,
  so wrong-room delivery cannot be reported as a successful target receipt.

## 0.1.9 Scope

- Preserves the triggering Keet message id when OpenClaw replies to an inbound
  Keet turn, so bridge adapters can use Keet's native reply/quote action.
- Declares durable `replyTo` support for the Keet message adapter and includes
  the reply target in OpenClaw receipts.
- Extends the local bridge boundary with `send --reply-to <message-id>` while
  keeping raw message text out of persistent evidence.

## 0.1.8 Scope

- Routes gateway-native Keet inbound deliveries through the OpenClaw channel
  runtime turn runner when that runtime surface is available.
- Keeps the legacy reply dispatcher as a compatibility fallback for older host
  runtimes.
- Verifies that Keet Desktop actually activated the requested sidebar room
  before polling visible messages, so direct and group reads cannot be silently
  mislabeled after a room switch.

## 0.1.5 Scope

- Persists the gateway bridge-poll cursor and bounded dedupe keys when
  `channels.keet.accounts.<account>.stateDir` is configured.
- Stops stale Keet UI rows from being replayed as fresh inbound turns after
  gateway restarts, Keet client restarts, or emergency recovery.
- Keeps persistent gateway state redacted: raw message text is not stored.

## 0.1.4 Scope

- Release-recovery bump for the `0.1.3` target resolver fix.
- No runtime code change from `0.1.3`.
- Required because ClawHub accepted/reserved version `0.1.3` but did not make
  it visible or installable through package inspect/search/readiness.

## 0.1.3 Scope

- Resolves Keet message targets through the OpenClaw messaging adapter so
  direct replies to allowlisted users can be delivered after gateway-native
  inbound turns.
- Supports bare allowlisted handles such as `plak0815`, explicit
  `keet:direct:<handle>` targets, and OpenClaw runtime direct-session targets
  without forwarding those locators to the bridge as chat names.

## 0.1.2 Scope

- Keeps the `0.1.1` gateway-native lifecycle behavior.
- Rejects foreign OpenClaw channel locators before the Keet bridge is invoked,
  so accidental targets such as Discord channel ids cannot be interpreted as
  Keet chat names.
- Adds the corrected Dev/Stage gateway lifecycle proof for the current release
  state.

## 0.1.1 Scope

- Adds gateway-native account lifecycle for the Keet bridge poller.
- The external bridge CLI is still the transport boundary, but the OpenClaw
  gateway owns account start/stop/health for configured Keet accounts.
- The systemd bridge/timer path remains a local fallback/rollback aid, not the
  primary release health path.

## 0.1.0 Scope

- Keet channel id `keet`.
- Durable outbound text through a local bridge CLI.
- Inbound polling through the documented bridge `poll` command.
- Direct-message release target with `dmPolicy: "allowlist"` and sender
  `plak0815`.
- Group enablement remains out of scope for the first public release.
- Native Pear/Holepunch transport remains out of scope for the first public
  release.

## Release Checklist

1. Run `npm ci`.
2. Run `npm run check`.
3. Run `npm pack --pack-destination .`.
4. Inspect the package contents and confirm there are no secrets, invite links,
   QR payloads, recovery phrases or local profile paths.
5. Install in Dev/Stage before production.
6. Verify fake bridge `send` and `poll` behavior.
7. Verify real Keet DM canary with `plak0815` only.

## Rollback

Rollback is OpenClaw-side only:

- disable the Keet channel in OpenClaw config, or remove the plugin from the
  active OpenClaw profile;
- stop the bridge polling timer/process if one was enabled;
- restart or reload the OpenClaw gateway only if required for config reload;
- leave Keet identity material untouched;
- leave Keet Desktop profile data, recovery phrases and DM/chat history
  untouched.

Rollback does not delete Keet chats or reset Keet identities.
