# Release Notes and Rollback

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
