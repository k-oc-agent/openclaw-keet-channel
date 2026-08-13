# Public / ClawHub Publish Readiness

Public/ClawHub publish is a Plak approval gate. Repo work, GitLab MRs, CI,
k-dev and k-stage verification may continue without another approval, but the
actual public release commands require an explicit approval message first.

This document is the handoff checklist for `Plak/openclaw-keet-channel#13`.
It prepares the release decision without publishing anything.

## Current Candidate

- Package: `@plak/openclaw-keet-channel`
- Version: `0.1.2`
- Channel id: `keet`
- Public source mirror: `https://github.com/k-oc-agent/openclaw-keet-channel`
- Public scope: direct-message bridge transport with allowlist-first inbound
  polling.
- Out of scope for first public release: productive groups, native Pear or
  Holepunch transport, recovery phrase handling, media, polls, reactions, edit
  or delete.

## Hard Gates

- Do not run `clawhub package publish` without explicit Plak approval.
- Do not run `npm publish` without explicit Plak approval.
- No OC production install, reinstall, config mutation, or gateway restart is
  allowed under the public-readiness work.
- No productive Keet groups, invite links, QR payloads, recovery phrases, raw
  keys, or profile data may be included in repo files, package artifacts, issue
  comments, or chat messages.

## Required Before Approval Request

1. Confirm `npm run check` is green.
2. Run `npm audit --omit=dev` and record the result.
3. Run `npm pack --pack-destination <temp-dir>` and inspect the package
   contents.
4. Confirm the package contains `dist`, `README.md`, `LICENSE`,
   `CHANGELOG.md`, `openclaw.plugin.json`, `docs/bridge-cli-contract.md`,
   `docs/release.md`, `docs/publish-readiness.md`, `docs/adr`, `docs/spec`,
   `docs/security`, and `scripts/fake-keet-bridge.mjs`.
5. Confirm the package does not contain local proof artifacts, Keet profile
   paths, invite links, QR payloads, recovery phrases, raw keys, `.git`,
   `node_modules`, or `.env` files.
6. Verify no current ClawHub package already resolves for this plugin name.
7. Re-check k-dev and k-stage if the package content or runtime code changes
   after the previous Dev/Stage proof.

## Tooling Readback

OpenClaw documentation describes plugin publication with:

```bash
clawhub package publish your-org/your-plugin --dry-run
clawhub package publish your-org/your-plugin
```

The locally installed `/usr/bin/clawhub` currently reports itself as `v0.5.0`
and is skill-oriented; `clawhub package publish --help` falls back to the
top-level skill CLI help and does not expose a `package` subcommand.

Use the current npm CLI package for plugin-package validation and dry-run
instead:

```bash
npm exec clawhub@latest -- package validate .
npm exec clawhub@latest -- package publish . --dry-run
```

Readback on 2026-08-13 showed `clawhub@0.23.3` exposes both
`package validate` and `package publish --dry-run`. The publish dry-run also
requires source metadata, so run it with the exact committed source:

```bash
npm exec clawhub@latest -- package publish . --dry-run \
  --source-repo <public-github-repo-or-accepted-source-url> \
  --source-commit <commit-sha>
```

Dry-run readback on 2026-08-13 rejected the internal GitLab source URL with
`--source-repo must be a GitHub repo or URL`. Do not continue to public publish
until the source location is made public/accepted by ClawHub, for example by
creating an approved public GitHub mirror or by confirming another accepted
source URL format.

The real publish command still remains approval-gated:

```bash
npm exec clawhub@latest -- package publish . \
  --source-repo <public-github-repo-or-accepted-source-url> \
  --source-commit <commit-sha>
```

The installed OpenClaw CLI can search and install ClawHub plugin packages:

```bash
openclaw plugins search keet
openclaw plugins install clawhub:<package-name>
```

Those commands are read/install surfaces, not proof that this repo can publish
with the current local ClawHub CLI.

## Approval Request Shape

When all readiness checks are green, ask Plak for a concrete approval phrase
instead of continuing silently:

```text
Approve Public/ClawHub publish for Keet plugin v0.1.2
```

If npm publication is also needed, ask for that separately. The public ClawHub
publish gate and npm publish gate are separate because they can expose the
package through different registries and trust paths.

## Rollback / Stop Criteria

Because this track does not mutate OC production, rollback before approval is
Git-only: close the MR or revert the readiness commit.

Stop before asking for approval if any check finds:

- package contents outside the allowlist;
- secret-like material or local profile paths;
- missing public source or package metadata;
- mismatched OpenClaw compatibility metadata;
- missing ClawHub plugin-package publishing command/tooling;
- ClawHub rejects the source repo or source URL;
- any requirement to touch OC production before public publish.
