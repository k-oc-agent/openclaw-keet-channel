# ClawHub Dogfood Proof - 2026-08-13

Issue: `Plak/openclaw-keet-channel#14`

## Scope

This proof prepares the OC production dogfood gate for the public ClawHub
package without touching OC production.

- Package: `@plak/openclaw-keet-channel@0.1.2`
- Install spec: `clawhub:@plak/openclaw-keet-channel`
- ClawHub package id: `rd7e1qt03hp88np78pnm9zaz298cdwbe`
- Public source: `https://github.com/k-oc-agent/openclaw-keet-channel`
- Source commit:
  `4b816c175dabe54b38539f26d35470330d00ddbf`

Out of scope under this proof:

- No OC production install, reinstall, config mutation, or gateway restart.
- No npm publish.
- No productive Keet group, invite link, QR payload, recovery phrase, raw key,
  or Keet identity mutation.

## Public Package Readback

`openclaw plugins search keet --json` resolved:

```text
@plak/openclaw-keet-channel  0.1.2  plak  source-linked
```

## k-dev Proof

- Host: `k-dev`
- Access path used: Tailscale `100.84.155.123`
- OpenClaw: `2026.7.1-2 (0790d9f)`
- Profile used: `--dev`
- Production config path: `/root/.openclaw/openclaw.json` absent before and
  after the proof.
- Evidence path: `/tmp/keet-clawhub-dogfood-dev-20260813/`

Install command:

```bash
openclaw --dev plugins install clawhub:@plak/openclaw-keet-channel \
  --force --acknowledge-clawhub-risk
```

Runtime inspect after install showed:

```json
{
  "version": "0.1.2",
  "status": "loaded",
  "channelIds": ["keet"],
  "source": "/root/.openclaw-dev/extensions/keet/dist/src/index.js",
  "install": {
    "source": "clawhub",
    "spec": "clawhub:@plak/openclaw-keet-channel",
    "installPath": "/root/.openclaw-dev/extensions/keet",
    "version": "0.1.2",
    "clawhubTrustDisposition": "clean",
    "clawhubTrustScanStatus": "clean",
    "clawpackSha256": "ebc2b1e264c680b19c6dcbafaadfdbb8b2cd875e91a98ab5f9722077915a205f"
  }
}
```

Fake bridge proof:

- `send` returned fake receipt `fake-keet-f64b121692bec244e873173b`.
- `poll` returned one direct fake event from `plak0815`.
- Evidence records `realKeetTouched=false`.

Gateway lifecycle readback from a temporary Dev gateway:

```text
- Keet default (Dev Keet Fake Bridge): enabled, configured, running, connected, transport:just now, mode:bridge-poll, dm:allowlist, health:healthy
```

The temporary Dev gateway was stopped after the proof; the Dev gateway service
read back `inactive`.

## k-stage Proof

- Host: `k-stage`
- Access path used: Tailscale `100.77.120.53`
- OpenClaw: `2026.7.1-2 (0790d9f)`
- Profile used: `--profile stage`
- Production config path: `/root/.openclaw/openclaw.json` absent before and
  after the proof.
- Evidence path: `/tmp/keet-clawhub-dogfood-stage-20260813/`

Install command:

```bash
openclaw --profile stage plugins install clawhub:@plak/openclaw-keet-channel \
  --force --acknowledge-clawhub-risk
```

Runtime inspect after install showed:

```json
{
  "version": "0.1.2",
  "status": "loaded",
  "channelIds": ["keet"],
  "source": "/root/.openclaw-stage/extensions/keet/dist/src/index.js",
  "install": {
    "source": "clawhub",
    "spec": "clawhub:@plak/openclaw-keet-channel",
    "installPath": "/root/.openclaw-stage/extensions/keet",
    "version": "0.1.2",
    "clawhubTrustDisposition": "clean",
    "clawhubTrustScanStatus": "clean",
    "clawpackSha256": "ebc2b1e264c680b19c6dcbafaadfdbb8b2cd875e91a98ab5f9722077915a205f"
  }
}
```

The Stage gateway was restarted after the ClawHub package install.

Fake bridge proof:

- `send` returned fake receipt `fake-keet-2bf8880c540421f50308b198`.
- `poll` returned one direct fake event from `plak0815`.
- Evidence records `realKeetTouched=false`.

Gateway lifecycle readback:

```text
- Keet default (Stage Keet Fake Bridge): enabled, configured, running, connected, transport:just now, mode:bridge-poll, dm:allowlist, health:healthy
```

## Production Gate

Dev and Stage are green for the public ClawHub package. OC production remains
blocked until Plak sends the exact approval phrase:

```text
Approve OC production dogfood install for Keet ClawHub package v0.1.2
```

Approved production scope for that later gate should be narrow:

- install or reinstall `clawhub:@plak/openclaw-keet-channel` in the OC
  production profile;
- preserve the current production Keet DM allowlist config;
- restart or reload only the OC production gateway if required to load the
  public package;
- verify `openclaw channels status --deep` shows Keet healthy;
- verify one allowlisted Keet DM smoke if Plak explicitly includes message send
  in the production approval.

Rollback for the later production gate:

- reinstall the previous local package artifact or disable the Keet plugin in
  OpenClaw config;
- restart or reload the OC production gateway only if required;
- leave Keet Desktop profile data, recovery phrases, DM history, groups,
  invites, and identities untouched.
