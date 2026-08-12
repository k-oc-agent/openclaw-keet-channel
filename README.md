# openclaw-keet-channel

OpenClaw channel plugin for Keet/Holepunch messaging.

This repo is the project-owned implementation track for the Keet Channel Plugin.
The first milestone is deliberately narrow: a packageable OpenClaw channel plugin
skeleton with a bridge-CLI transport, explicit allowlist policy, tests, and
documentation. Native Pear/Holepunch transport is a later gate.

## Current State

- Channel id: `keet`
- OpenClaw surface: external channel plugin
- MVP transport: local bridge command with argv-only execution
- Supported send capability: durable final text
- Inbound polling: bridge `poll` contract with allowlist routing and redacted
  dedupe state
- Designed but not production-enabled: native gateway lifecycle
- Disabled for MVP: media, polls, reactions, thread/reply preservation
- Production group enablement: blocked until explicit allowlist/security gate

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
- OpenClaw docs: `docs/plugins/sdk-channel-plugins.md`,
  `docs/plugins/sdk-channel-inbound.md`, `docs/plugins/sdk-channel-outbound.md`
- Tracking issue: `Plak/openclaw-keet-channel#1`
