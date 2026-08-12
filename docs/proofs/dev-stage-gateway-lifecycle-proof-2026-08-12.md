# Dev/Stage Gateway Lifecycle Proof - 2026-08-12

## Scope

This proof covers the current `main` state after the gateway-native lifecycle
and target-normalization changes:

- `f137cf8` / `v0.1.1`: gateway-native Keet lifecycle.
- `1beab9e`: rejects foreign Keet targets before bridge execution.

It corrects the process gap where earlier Dev/Stage evidence from `v0.1.0`
was not sufficient for the later lifecycle change.

## Artifact

- Repo: `/tmp/openclaw-keet-channel`
- Commit tested: `1beab9e`
- Package: `/tmp/openclaw-keet-channel-gate-20260812/plak-openclaw-keet-channel-0.1.1.tgz`
- SHA-256:
  `04d91cace39b81d21e0acb13a1669c65808d14fb0c5537c7dcdc8718133cb896`
- Local check: `npm run check` passed with `30` tests.

Package contents were produced with `npm pack --pack-destination`.

## k-dev Proof

- Host: `k-dev`
- Access path used: Tailscale `100.84.155.123`
- OpenClaw: `2026.7.1-2 (0790d9f)`
- Node: `v24.19.0`
- Profile used: `--dev`
- Install path: `/root/.openclaw-dev/extensions/keet`
- Production config path: `/root/.openclaw/openclaw.json` absent before and
  after the proof.
- Dev config uses fake bridge:
  `/root/.openclaw-dev/extensions/keet/scripts/fake-keet-bridge.mjs`

Plugin inspect after install showed:

```json
{
  "id": "keet",
  "version": "0.1.1",
  "status": "loaded",
  "channelIds": ["keet"],
  "source": "/root/.openclaw-dev/extensions/keet/dist/src/index.js",
  "installPath": "/root/.openclaw-dev/extensions/keet"
}
```

Fake bridge proof:

- `send` returned fake receipt
  `fake-keet-03ab3d4a5252a0d6267972cc`.
- `poll` returned one direct fake event from `plak0815`.
- Evidence files under `/tmp/keet-dev-gate-20260812/` record
  `realKeetTouched=false`.

Gateway lifecycle readback from a temporary Dev gateway:

```text
- Keet default (Dev Keet Fake Bridge): enabled, configured, running, connected, transport:just now, mode:bridge-poll, dm:allowlist, health:healthy
```

The temporary Dev gateway was stopped after the proof.

## k-stage Proof

- Host: `k-stage`
- Access path used: Tailscale `100.77.120.53`
- OpenClaw: `2026.7.1-2 (0790d9f)`
- Node: `v24.19.0`
- Profile used: `--profile stage`
- Install path: `/root/.openclaw-stage/extensions/keet`
- Production config path: `/root/.openclaw/openclaw.json` absent before and
  after the proof.
- Stage config uses fake bridge:
  `/root/.openclaw-stage/extensions/keet/scripts/fake-keet-bridge.mjs`

Plugin inspect after install showed:

```json
{
  "id": "keet",
  "version": "0.1.1",
  "status": "loaded",
  "channelIds": ["keet"],
  "source": "/root/.openclaw-stage/extensions/keet/dist/src/index.js",
  "installPath": "/root/.openclaw-stage/extensions/keet"
}
```

The Stage gateway was restarted after the fresh package install.

Fake bridge proof:

- `send` returned fake receipt
  `fake-keet-5a842f61376fb2f8669d454b`.
- `poll` returned one direct fake event from `plak0815`.
- Evidence files under `/tmp/keet-stage-gate-20260812/` record
  `realKeetTouched=false`.

Gateway lifecycle readback:

```text
- Keet default (Stage Keet Fake Bridge): enabled, configured, running, connected, transport:just now, mode:bridge-poll, dm:allowlist, health:healthy
```

## Containment

- No production OpenClaw config existed on k-dev or k-stage.
- No production Keet client, Keet identity, recovery phrase, invite link, QR
  payload, real Keet DM, or real Keet group was used.
- Dev/Stage proofs used only the packaged fake bridge.
- k-dev used a temporary foreground gateway and stopped it after status proof.
- k-stage restarted only the existing Stage gateway.

## Result

The current `main` package passes the missing Dev/Stage lifecycle gate for fake
bridge install, fake `send`, fake `poll`, and gateway-native health on both
hosts.
