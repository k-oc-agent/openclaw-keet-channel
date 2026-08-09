# Stage Install Proof with Fake Keet Bridge

## Purpose

Prove the package installs into a non-production OpenClaw profile and can send
through the bridge-CLI contract without touching real Keet state, production
OpenClaw config, sessions, crons, or Keet groups.

## Rollback

The proof must use an isolated OpenClaw profile such as `stage` and record the
profile path before install. Rollback is:

```bash
openclaw --profile stage plugins uninstall keet
```

If the profile was created solely for this proof and contains no unrelated
state, remove only that profile's plugin/state artifacts after recording the
evidence path. Do not remove or edit `/root/.openclaw/openclaw.json`.

## Required Commands

```bash
npm ci
npm run check
npm pack --json
sha256sum plak-openclaw-keet-channel-*.tgz
openclaw --profile stage plugins install ./plak-openclaw-keet-channel-*.tgz --force
openclaw --profile stage plugins inspect keet --runtime --json
openclaw --profile stage channels list --all
```

Fake bridge smoke:

```bash
KEET_FAKE_BRIDGE_LOG=/path/to/evidence/fake-bridge.ndjson \
  node scripts/fake-keet-bridge.mjs send --chat stage-fake-chat --text "stage smoke"
```

## Evidence Checklist

- Host identity (`hostname`, `id -u -n`, current git commit).
- OpenClaw profile and config path used for the install.
- Package path and SHA-256.
- `plugins inspect keet --runtime --json` output.
- `channels list --all` readback showing Keet discovery if supported.
- Fake bridge NDJSON with `realKeetTouched=false`.
- Proof that `/root/.openclaw/openclaw.json` was not changed.
- Proof that no real Keet chat/group/session/cron was used.
