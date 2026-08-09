# Dev/Stage Host Install Proof - 2026-08-09

## Scope

Issue: `Plak/openclaw-keet-channel#6`

This proof corrects the earlier profile-only proof: Dev and Stage are the
dedicated hosts `k-dev` and `k-stage`, not an ad-hoc `--profile stage` run on
the main OpenClaw host.

## Artifact

- Main commit: `b456302547a29b121873c3c4a212a73f0700eb87`
- Package: `plak-openclaw-keet-channel-0.1.0.tgz`
- SHA-256:
  `9703c50e6b93483dfda48c0128e9f749b71b495942456e17c1b56d401f0497eb`

## k-dev Proof

- Host: `k-dev`
- Access path used: Tailscale `100.84.155.123`
- OpenClaw before proof: absent
- Bootstrap performed: installed `openclaw@2026.7.1-2` globally through npm
- OpenClaw after bootstrap: `OpenClaw 2026.7.1-2 (0790d9f)`
- Profile used: `--dev`
- Install path: `/root/.openclaw-dev/extensions/keet`
- Production config path: `/root/.openclaw/openclaw.json` missing before and
  after; no production OpenClaw profile existed on this host
- Gateway service: inactive/dead before and after, `NRestarts=0`

Runtime inspect:

```json
{
  "id": "keet",
  "version": "0.1.0",
  "status": "loaded",
  "channelIds": ["keet"],
  "source": "/root/.openclaw-dev/extensions/keet/dist/src/index.js",
  "installPath": "/root/.openclaw-dev/extensions/keet",
  "diagnostics": []
}
```

Channel readback:

```text
- Keet: installed, not configured, disabled
```

Fake bridge receipt:

```text
fake-keet-c0d13f3fab0b818a25c57fb5
```

Fake bridge evidence recorded `realKeetTouched=false`, chat
`dev-fake-chat`, redacted argv text, text length `37`, and SHA-256
`4bbffb1846d36e8417ceab1d69138ff03c59a5b070b509d108a58ae0026b4edf`.

## k-stage Proof

- Host: `k-stage`
- Access path used: Tailscale `100.77.120.53`
- Existing stage gateway: inactive/dead before and after, `NRestarts=0`
- Existing stage profile: `/root/.openclaw-stage/openclaw.json`
- OpenClaw before proof: old `2026.5.28` via `/usr/bin/openclaw`
- Bootstrap performed:
  - installed `openclaw@2026.7.1-2` globally through npm
  - fixed stale `/usr/local/bin/node` shadowing by moving it to
    `/usr/local/bin/node.20260809-pre-openclaw-24.13.1`
  - linked `/usr/local/bin/node -> /usr/bin/node`
- OpenClaw after bootstrap: `OpenClaw 2026.7.1-2 (0790d9f)`
- Node after bootstrap: `v24.19.0`
- Profile used: `--profile stage`
- Install path: `/root/.openclaw-stage/extensions/keet`
- Production config path: `/root/.openclaw/openclaw.json` missing before and
  after; no production OpenClaw profile existed on this host

Runtime inspect:

```json
{
  "id": "keet",
  "version": "0.1.0",
  "status": "loaded",
  "channelIds": ["keet"],
  "source": "/root/.openclaw-stage/extensions/keet/dist/src/index.js",
  "installPath": "/root/.openclaw-stage/extensions/keet",
  "diagnostics": []
}
```

Channel readback:

```text
- Keet: installed, not configured, disabled
```

Fake bridge receipt:

```text
fake-keet-1853fc29f852c84b710e7eff
```

Fake bridge evidence recorded `realKeetTouched=false`, chat
`stage-host-fake-chat`, redacted argv text, text length `39`, and SHA-256
`2ea9d8c15b03db2971263614f3e2edda2d1766b13605b3da9e4d152f0ee87dea`.

## Side Effects

`k-stage` ran OpenClaw state migrations when the newer CLI touched the existing
stage profile. The migration archived legacy sidecar state under
`/root/.openclaw-stage/*.migrated` paths and moved shared state into
`/root/.openclaw-stage/state/openclaw.sqlite`. The stage gateway remained
stopped; no production profile existed or was mutated.

## Containment

- No real Keet account configured.
- No real Keet chat, group, invite, recovery phrase or identity key used.
- No production OpenClaw config existed on either host.
- No production gateway or stage gateway was started or restarted.
- Both hosts show Keet as installed, not configured and disabled.

## Production Impact

This closes the Dev/Stage host proof gap. Production use is still blocked by
`Plak/openclaw-keet-channel#5` and requires an explicit real target, allowlist,
bridge path, rollback command and evidence path.
