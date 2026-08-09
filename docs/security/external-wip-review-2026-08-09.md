# External WIP Review: Keet/OpenClaw Repos

Date: 2026-08-09

## Scope

Reviewed read-only:

- `https://github.com/pepeneif/openclaw-keet`
- `https://github.com/pepeneif/Keet-drop-in-module-for-Openclaw-clones`

No install scripts, package installs, tests, or repo code were executed.

## Verdict

Do not fork either repo wholesale. Use a hybrid strategy that is effectively
build-from-scratch, borrowing only small MIT-compatible design ideas with
attribution if they survive later review.

## openclaw-keet

Findings:

- Minimal plugin manifest plus standalone P2P demos and a plugin attempt.
- Dependencies include `hypercore`, `hyperdht`, `hyperswarm`.
- Some files require undeclared dependencies such as `cabal-core` and `level`.
- Mixed ESM, TypeScript and CommonJS with no lockfile, no `tsconfig`, and no
  meaningful tests.
- The OpenClaw API usage appears hypothetical rather than proven against the
  installed SDK.
- Security gaps: no inbound identity verification, no allowlist enforcement, no
  message signing, and sender identity appears peer-provided.

License: MIT license file present.

## Keet-drop-in-module-for-Openclaw-clones

Findings:

- Broad installer/generator rather than a clean OpenClaw channel plugin.
- The installer downloads Node, runs package installation, writes runtime files,
  kills processes, removes IPC/key/state files, and generates code into target
  workspaces.
- JSON-RPC over Unix socket lacks visible permission-hardening proof.
- Persists key material and has no clear production secret-storage boundary.
- Generated adapter imports an OpenClaw SDK path, but there is no proof it
  matches current SDK behavior.

License: `package.json` says MIT; no license file was found in the review.

## Decision Input

Use `openclaw-keet` only as conceptual seed for Hyperswarm topic messaging and
manifest naming. Use the drop-in repo only for ideas around invite/key tests and
long-lived session semantics. Keep this repo's implementation independent,
small, tested, and OpenClaw-SDK-first.
