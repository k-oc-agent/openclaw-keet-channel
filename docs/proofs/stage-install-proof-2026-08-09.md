# Stage Install Proof - 2026-08-09

## Scope

Issue: `Plak/openclaw-keet-channel#2`

This proof installed the Keet channel plugin package into an isolated OpenClaw
`stage` profile with a fake bridge on the main OpenClaw host. It did not
configure a real Keet account, send to a real Keet chat, restart the production
gateway, or mutate the production OpenClaw config.

This is a package/profile proof only. The dedicated Dev/Stage host proof lives
in `docs/proofs/dev-stage-host-install-proof-2026-08-09.md`.

## Evidence

- Host: `openclaw.pl.bogacki.org`
- User: `root`
- Branch: `test/stage-install-proof-2`
- Base commit before this proof slice: `47f079e65f983594fa3cc25cd4a5601cc8e554cc`
- OpenClaw profile: `stage`
- Stage config: `/root/.openclaw-stage/openclaw.json`
- Installed package: `plak-openclaw-keet-channel-0.1.0.tgz`
- Package SHA-256: `eb70b5f197fd9e18fdd40b65ce3acf23ca3db8ce9981cdd1c65762818a79938c`
- Evidence dir: `/tmp/openclaw-keet-channel-stage-proof-20260809T1648Z`

## Commands Run

```bash
npm run check
npm audit --omit=dev
npm pack --json
openclaw --profile stage plugins install ./plak-openclaw-keet-channel-0.1.0.tgz --force
openclaw --profile stage plugins inspect keet --runtime --json
openclaw --profile stage channels list --all
KEET_FAKE_BRIDGE_LOG=/tmp/openclaw-keet-channel-stage-proof-20260809T1648Z/fake-bridge.ndjson \
  node scripts/fake-keet-bridge.mjs send --chat stage-fake-chat --text "stage fake bridge smoke 2026-08-09"
KEET_FAKE_BRIDGE_LOG=/tmp/openclaw-keet-channel-stage-proof-20260809T1648Z/transport-fake-bridge.ndjson \
  node --input-type=module -e 'import { sendTextWithBridgeCli } from "./dist/src/transport.js"; const r = await sendTextWithBridgeCli({ bridgeCommand: new URL("./scripts/fake-keet-bridge.mjs", import.meta.url).pathname, to: "stage-fake-chat", text: "stage transport smoke 2026-08-09" }); console.log(JSON.stringify(r));'
```

## Readback

`plugins inspect keet --runtime --json` showed:

```json
{
  "id": "keet",
  "status": "loaded",
  "channelIds": ["keet"],
  "source": "/root/.openclaw-stage/extensions/keet/dist/src/index.js",
  "installPath": "/root/.openclaw-stage/extensions/keet",
  "diagnostics": []
}
```

`channels list --all` showed:

```text
- Keet: installed, not configured, disabled
```

Stage config contains only plugin enablement for the proof:

```json
{
  "plugins": {
    "entries": {
      "keet": {
        "enabled": true
      }
    }
  },
  "channels": null
}
```

Fake bridge smoke returned deterministic fake receipts:

```text
fake-keet-c257e7ea55e47c9eb40b2cce
fake-keet-293bce110e6cdafa6211c60a
```

The fake bridge evidence records `realKeetTouched=false` and redacts message
text while preserving text hashes and lengths.

## Containment

- Production config hash before/after remained
  `4fd29c809d6b52ec57d66ffb1973a2a7b4ffdac94051b3ce1c55e23a148c2aa3`.
- Production user gateway stayed active with `NRestarts=0`; it was not
  restarted to load the stage plugin.
- No `channels.keet` runtime account was configured.
- No real Keet target, recovery phrase, invite, session, cron, or group was
  used by this proof.
- The OpenClaw CLI created/migrated isolated profile state under
  `/root/.openclaw-stage` when the `stage` profile was first queried.

## Packaging Finding

The first install attempt failed because `openclaw.install.minHostVersion` was
`2026.7.1` instead of the installer-required Semver floor `>=2026.7.1`.
This slice fixes that metadata and adds a regression test.
