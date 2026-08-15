# openclaw-keet-channel

OpenClaw channel plugin for Keet/Holepunch messaging.

This repo is the project-owned implementation track for the Keet Channel Plugin.
The first milestone is deliberately narrow: a packageable OpenClaw channel plugin
skeleton with a bridge-CLI transport, explicit allowlist policy, tests, and
documentation. Native Pear/Holepunch transport is a later gate.

## Current State

- Current production/ClawHub candidate: `0.1.21`.
- Channel id: `keet`
- OpenClaw surface: external channel plugin
- MVP transport: local bridge command with argv-only execution, currently backed
  by a Keet Desktop CDP bridge candidate
- Supported send capability: text send to configured DM and group targets
- Inbound polling: bridge `poll` contract with allowlist routing and redacted
  dedupe state
- Readback: `openclaw message read --channel keet` is implemented for bounded
  visible message reads through the bridge
- Reply safety: native reply/quote attempts fail closed when Keet Desktop does
  not select a real reply target
- Delivery guards: wrong-room, duplicate retry and internal status/progress text
  guards are active
- Join diagnostics: redacted `Autobase is closing` detection for failed invite
  joins before any profile recovery is attempted
- Production group enablement: allowed only for explicit configured groups and
  allowlisted senders
- Not currently implemented as user journeys: forward, edit, reactions, pins,
  media/attachments, real Keet invite generation, real `chat-info`, message
  deletion, group deletion and join-rights automation
- Not live-tested in production because it is destructive or fixture-sensitive:
  deleting messages, deleting group chats, and joining groups as
  admin/member/read-only
- Native Pear/Holepunch transport remains a later gate; do not store recovery
  phrases, backup passwords, invite secrets, QR payloads or raw key material in
  this repo or chat

## Development

```bash
npm install
npm run check
```

The package uses TypeScript ESM and the OpenClaw plugin SDK from the local
OpenClaw install during development.

Stage install proof for the bridge-CLI MVP is documented in
`docs/proofs/stage-install-fake-bridge.md`.
The public bridge command contract is documented in
`docs/bridge-cli-contract.md`; release and rollback boundaries are documented
in `docs/release.md`.

Real Dev/Stage smokes use dedicated persistent Keet test identities. Their
recovery phrases and backup metadata live only in OpenBao; repo docs and
evidence may reference the OpenBao path but must not contain the secret values.
The real DM, group chat, reply, restart, recovery, negative and security UAT
matrix lives in `docs/uat/dev-stage-real-uat.md`. The repeatable harness and
secret-safe evidence rules live in
`docs/uat/persistent-dev-stage-harness.md`.
The current production capability snapshot for the ClawHub release candidate is
`docs/uat/current-version-0.1.20.md`; `0.1.21` is a ClawHub label/description
correction release with the same runtime behavior.

## Configuration Sketch

```json
{
  "channels": {
    "keet": {
      "enabled": true,
      "defaultAccount": "default",
      "accounts": {
        "default": {
          "enabled": true,
          "bridgeCommand": "/usr/local/bin/keet-bridge",
          "dmPolicy": "allowlist",
          "allowFrom": ["plak0815"],
          "defaultTo": "Plak"
        }
      }
    }
  }
}
```

Do not store Keet recovery phrases, backup passwords, invite secrets, or raw key
material in this repo or in chat.

## Quality Gates

The delivery chain for this project is:

1. Spec/ADR
2. Tests
3. Implementation
4. Review
5. Security review
6. Stage install proof
7. Stage E2E proof
8. Production gate only after explicit approval

## References

- Local prototype: `bin/keet_bridge_once.py`, `bin/keet_cdp_driver.mjs`,
  `bin/keet-bridge-guard` in `Plak/k-workspace`
- Repo-owned CDP bridge candidate: `scripts/keet-cdp-bridge.mjs`
  - reads enabled direct/group targets from `/etc/openclaw/keet-bridge.json`
    or `KEET_BRIDGE_CONFIG`
  - supports the plugin poll contract without a `--chat` argument
- OpenClaw docs: `docs/plugins/sdk-channel-plugins.md`,
  `docs/plugins/sdk-channel-inbound.md`, `docs/plugins/sdk-channel-outbound.md`
- Tracking issue: `Plak/openclaw-keet-channel#1`
