# OpenClaw Version Compatibility UAT - 2026-09-05

## Scope

This UAT tracks the Keet plugin after K-OC Ops disabled the production Keet
channel because 2026.8.2 runtime logs showed repeated CDP poll timeouts.

The production channel stayed disabled during this work. No production Gateway
restart, Keet profile reset, login/recovery mutation, destructive cleanup, or
live Keet send was performed.

## K-OC Ops Coordination

- Runtime incident owner: `openclaw/k-workspace#40`.
- Plugin-side fix issue: `Plak/openclaw-keet-channel#44`.
- Current production state at intake: plugin `0.1.20` installed and loaded, but
  `channels.keet.enabled=false` and the default Keet account is disabled.
- K-OC Ops evidence: recurring `Keet poll failed` from
  `keet-cdp-bridge.mjs poll --account default --limit 50 --cursor 6` with
  `browserType.connectOverCDP: Timeout 30000ms exceeded`.

## Compatibility Matrix

| OpenClaw version | Result | Evidence | Notes |
| --- | --- | --- | --- |
| `2026.8.1` | pass | `npm install --save-dev openclaw@2026.8.1`; `npm run check` -> 13 files / 75 tests passed | SDK/API compatibility green. |
| `2026.8.2` | pass with runtime caveat fixed | `npm install --save-dev openclaw@2026.8.2`; `npm run check` -> 13 files / 75 tests passed | Matches the live K-OC incident version. Existing plugin compiled, but CDP poll timeout behavior needed hardening. |
| `2026.9.1` | pass | `npm install --save-dev openclaw@2026.9.1`; `npm run check` -> 13 files / 75 tests passed | Upstream/latest compatibility green for the plugin surface. |

## Fix In This Slice

The SDK compatibility was green, but the runtime failure mode was too expensive:
Playwright's default CDP connect timeout allowed poll calls to sit for 30s, and
the OpenClaw bridge process wrapper allowed up to 60s. That matches the
operational failure reported by K-OC Ops.

This slice makes the poll failure bounded:

- CDP connect timeout defaults to 5s.
- The bridge transport limits `poll` subprocesses to 15s.
- `send` and `read` keep the existing 60s budget because they may include
  deliberate UI navigation and post-send/readback work.
- The CDP timeout can be overridden for diagnostics with
  `KEET_CDP_CONNECT_TIMEOUT_MS` or `--cdp-timeout-ms`; invalid values fall back
  to the bounded default.

## Release Gate

`0.1.22` is a plugin-side candidate only. Production remains on the K-OC
Ops-disabled state until a separate re-enable/install/Gateway gate is approved
and coordinated through `openclaw/k-workspace#40`.
