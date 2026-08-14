# Persistent Dev/Stage Keet UAT Harness

Issue: `Plak/openclaw-keet-channel#19`

This runbook makes the persistent real Keet Dev/Stage UAT repeatable without
turning local CDP/UI operator work into untracked evidence. It complements the
matrix in `docs/uat/dev-stage-real-uat.md` and uses the plan in
`docs/uat/persistent-dev-stage-plan.json`.

## No Secret Evidence Guard

Run the repository guard before and after any host-side UAT:

```bash
node scripts/keet-real-uat-harness.mjs validate
node scripts/keet-real-uat-harness.mjs evidence-skeleton --environment dev
node scripts/keet-real-uat-harness.mjs evidence-skeleton --environment stage
```

The guard fails closed when a plan or evidence skeleton contains recovery
phrase fields, backup password fields, invite links, QR payloads, raw key
material or secret-looking long word sequences. Evidence may contain OpenBao
paths, profile paths, recovery phrase length, message ids, receipt ids,
timestamps, text lengths and hashes.

## Persistent Test Fixtures

Use the same accounts across releases:

- Dev A/B on `k-dev`: `kv/data/openclaw/keet/dev/test-a`,
  `kv/data/openclaw/keet/dev/test-b`
- Stage A/B on `k-stage`: `kv/data/openclaw/keet/stage/test-a`,
  `kv/data/openclaw/keet/stage/test-b`

The isolated profile paths are defined in
`docs/uat/persistent-dev-stage-plan.json`. Do not create routine throwaway
accounts. Rotate or recreate only for explicit security, corruption or recovery
reasons with redacted evidence.

## Host UAT Flow

Run Dev first. Stage follows only after Dev is green.

1. Validate the plan with `scripts/keet-real-uat-harness.mjs validate`.
2. Read OpenBao metadata on the target host without printing secret values.
   Acceptable output is key presence plus `recoveryPhraseLength=24`.
3. Start the two isolated Keet profiles for the environment and record only
   process ids, CDP ports and profile paths.
4. Verify the configured group membership with the bridge `chat-info` command
   or the equivalent CDP readback.
5. Run DM A<->B:
   - A sends to B.
   - B bridge-poll receives the direct event.
   - OpenClaw processes the direct event, updates the expected direct session
     and emits the expected reply receipt or explicit no-reply decision.
   - B sends to A.
   - A bridge-poll receives the direct event.
   - OpenClaw processes the reverse direct event with the same session/route
     assertions.
6. Run Group A<->B:
   - A sends in the environment UAT group.
   - B bridge-poll receives the group event.
   - OpenClaw processes the group event under the configured group route only.
   - B sends in the environment UAT group.
   - A bridge-poll receives the group event.
   - OpenClaw processes the reverse group event under the same group route.
7. Run native reply processing:
   - Reply natively to an OpenClaw message.
   - Verify bridge-poll emits the user-authored body, not the quoted parent.
   - Verify OpenClaw processes that body and does not drop it as a `K OpenClaw`
     echo.
8. Record message ids, receipt ids, route keys, session ids, processing status,
   text lengths and hashes only.
9. Stop the two test Keet processes and verify no CDP test process remains.

## Known Keet Constraints

- Keet profile copy is rejected as an `Invalid device file, was moved unsafely`
  condition. Restore or initialize profiles from OpenBao-held recovery material
  on the target host instead of copying profiles between hosts.
- Keet backup-file export is pending because the native GTK save dialog is not
  reliably automatable under headless Xvfb. Until that is solved, OpenBao-held
  recovery material is the durable recovery path.
- Invite links are transient operator handoff material. Never paste them into
  GitLab, Discord, logs or committed evidence.

## GitLab Evidence Shape

Post one redacted note per environment:

- package version, commit and archive hash if a package was under test
- host, profile paths and OpenBao paths
- DM A<->B message ids or receipts
- Group A<->B message ids or receipts
- bridge-poll direct and group route evidence
- OpenClaw direct/group processing evidence: session id or route key,
  processing status and outbound reply receipt or explicit no-reply reason
- native reply processing evidence: quote/body extraction status and processing
  result
- cleanup status
- explicit statement that no production config, gateway restart or production
  Keet group was touched

## Prod Stop

This harness is a Dev/Stage gate only. A production plugin install, production
gateway restart, production Canary smoke or Plak personal DM smoke requires a
separate explicit production gate after this harness is green.
