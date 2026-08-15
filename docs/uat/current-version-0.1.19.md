# Current Version UAT Report: 0.1.19

Issue: `Plak/openclaw-keet-channel#30`

Version under test: `@plak/openclaw-keet-channel@0.1.19`

Date: 2026-08-15

## Scope

This report records what the currently installed production version can do and
what it cannot do. It is intentionally a test and documentation slice only:
no code fix, no version bump, no production config change and no gateway
restart were part of this UAT.

The current production bridge is the local Keet Desktop CDP bridge. It supports
`send` and `poll` only. The broader bridge contract already documents future
`invite` and `chat-info` commands, but the currently installed CDP bridge does
not implement them.

## Status Classes

| Status | Meaning |
|---|---|
| `pass` | Tested against the current 0.1.19 production install or current repo tests and behaved as expected. |
| `fail` | Tested and did not behave as required. |
| `covered by harness` | Covered by repo tests or fake bridge contract only; not proven with real Keet production state. |
| `not supported` | The current plugin or CDP bridge has no implemented action for this journey. |
| `not executed: destructive` | A real production run would delete or mutate user data/chats; do not execute until isolated UAT identities and rooms exist. |
| `blocked: missing fixture` | Needs dedicated Dev/Stage test identities, rights setup or disposable test rooms before it can be tested safely. |

## Evidence Summary

| Evidence | Result |
|---|---|
| Repo check | `npm run check` passed: 71 tests, 13 files. |
| Audit | `npm audit --omit=dev` found 0 vulnerabilities. |
| UAT harness validation | `node scripts/keet-real-uat-harness.mjs validate` passed; plan SHA256 `5c59e44c64a9240f49a0c04e473fccc0414a3c08636f9dd9bc5e456521043da1`. |
| Focused bridge tests | `npm test -- --run tests/keet-cdp-bridge.test.ts` passed: 16 tests. |
| Production install readback | `openclaw plugins inspect keet` loaded version `0.1.19` from `/tmp/keet-pack-20260815-0119-kmQcVy/plak-openclaw-keet-channel-0.1.19.tgz`. |
| Gateway/channel health | `openclaw-gateway.service` active/running, MainPID `1507128`, `NRestarts=0`; Keet channel healthy in `bridge-poll` mode. |
| DM outbound smoke | normal DM send token `UAT-019-DM-20260815T100715Z-1630568` returned Keet message id `message-3ei7rsq9u9cujere9toaoypuf7zdru5yetpxpca7mo1675dzzbuo_271`; DOM readback in `Plak` confirmed exactly that outgoing row. |
| Canary outbound smoke | normal Canary group send token `UAT-019-CANARY-20260815T100715Z-1630568` returned Keet message id `message-unahcio5dwtib1jbmexjstaq4iuxiyrasf3zu3sgfxz9wwpk3muy_72`; DOM readback in `K OC Keet Canary 2026-08-11` confirmed exactly that outgoing row. |
| Status leak guard | sending `Model Fallback: UAT-019-STATUS-20260815T100715Z-1630568` failed closed with `OutboundDeliveryError: Refusing to send internal OpenClaw status text to Keet`; DOM readback found no visible token row. |
| Canary inbound processing | Production 0.1.19 processed Canary group inbound `message-659jop4frtfk6ydotpaa5nooi84kn4fu9bf3y6xojg654dimot6o_4`; OpenClaw session `d8e73ccc-153a-4721-87db-d5ef8b02f8a5` sent Keet reply `message-unahcio5dwtib1jbmexjstaq4iuxiyrasf3zu3sgfxz9wwpk3muy_71`; DOM readback confirmed outgoing text `3675` in the active Canary room. |
| Keet message read | `openclaw message read --channel keet ...` returned `Channel keet is unavailable for message actions (plugin not loaded)` while send, poll and channel health were working. |
| Current CDP bridge unsupported actions | `invite`, `chat-info`, `delete` and `forward` returned `unsupported action` on the installed CDP bridge. |
| Fake bridge contract | `fake-keet-bridge.mjs invite` and `chat-info` returned expected fake JSON; this is contract coverage only, not real Keet proof. |

## Function Matrix

| Area | User journey / function | 0.1.19 status | Current result | Evidence / next gate |
|---|---|---|---|---|
| Install | Install/readback current package | `pass` | Production loads `0.1.19` from the expected archive. | `openclaw plugins inspect keet`. |
| Health | Gateway and channel health | `pass` | Gateway active, Keet running/connected/healthy in `bridge-poll`. | `openclaw channels status keet`, `systemctl --user show`. |
| Outbound DM | normal DM send | `pass` | Fresh DM token reached the `Plak` Keet room exactly once. | Message id `_271`, DOM readback. |
| Outbound group | normal Canary group send | `pass` | Fresh Canary token reached the Canary group exactly once. | Message id `_72`, DOM readback. |
| Inbound poll | Direct bridge poll | `pass` | Poll emits allowlisted direct rows from `plak0815`. | CDP bridge `poll --account default --limit 20`. |
| Inbound poll | Group bridge poll | `pass` | Poll emits Canary group rows from `sender=plak0815`, including role-normalized `Plak`/`Admin` rows. | CDP bridge `poll --account default --limit 20`. |
| Processing | Fresh Canary group inbound processing | `pass` | OpenClaw processed the Canary group request and sent visible reply `3675`. | Session `d8e73ccc-...`, receipt `_71`, DOM readback. |
| Processing | Fresh DM inbound processing | `blocked: missing fixture` | Not rerun as fresh 0.1.19 UAT because it requires a peer-authored Keet DM from Plak or a dedicated test identity. Older gates covered this path, but this report does not claim a fresh 0.1.19 DM inbound proof. | Add Dev/Stage test identities or request a fresh Plak DM prompt in a separate gate. |
| Reply | OpenClaw reply to inbound group message | `pass` | `message(action=send)` used `replyTo` for the Canary inbound and returned a Keet receipt. | Receipt `_71` with `replyTo=message-659..._4`. |
| Reply | native quote reply parsing | `pass` | Existing tests verify body extraction and echo filtering; current Canary processing used the reply target. | `tests/keet-cdp-bridge.test.ts`, `tests/inbound.test.ts`, #15 evidence. |
| Reply | native quote reply visual structure | `covered by harness` | Current DOM readback confirmed visible reply row but did not extract quote block structure for `_71`. | Future RC gate should capture quote block DOM explicitly. |
| Reply | Forward menu during reply selection | `pass` | Keet Desktop `Forward` / `Forward Message` menu items are treated as unsupported Forward actions and fail closed instead of silently becoming a normal reply. | Focused bridge tests, 0.1.17 fix. |
| Forward | User-facing message Forward | `not supported` | There is no OpenClaw Keet forward action and the current CDP bridge returns `unsupported action forward`. | Needs a new spec and UAT fixture before implementation. |
| Read | `openclaw message read --channel keet` | `fail` | CLI returns `Channel keet is unavailable for message actions (plugin not loaded)` despite healthy runtime send/poll. | Separate hygiene issue should cover the CLI read path. |
| Delete | delete own message | `not executed: destructive` | Not run against production Keet history. Dry-run only returns OpenClaw dry-run payload and does not prove Keet delete support. Current CDP bridge returns `unsupported action delete`. | Requires isolated UAT room and explicit delete semantics. |
| Delete | delete another user's message | `not executed: destructive` | Not run; destructive and rights-sensitive. | Requires isolated UAT room with admin/non-admin identities. |
| Delete | delete group chat | `not executed: destructive` | Not run; destructive to room state. Current bridge has no group deletion command. | Requires disposable UAT group and explicit rollback/cleanup contract. |
| Edit | edit sent message | `not supported` | No Keet edit action exists in the plugin or CDP bridge. | Needs product decision and bridge contract. |
| Reactions | react to message | `not supported` | No Keet reaction action exists in the plugin or CDP bridge. | Needs product decision and bridge contract. |
| Pins | pin/unpin message | `not supported` | No Keet pin action exists in the plugin or CDP bridge. | Needs product decision and bridge contract. |
| Media | send attachment/media | `not supported` | Current Keet adapter is text-only. | Needs media contract and real Keet evidence. |
| Invite | generate group invite | `covered by harness` | Fake bridge supports `invite`; current production CDP bridge returns `unsupported action invite`. | Real CDP/native bridge support still missing. |
| Membership | `chat-info` group membership readback | `covered by harness` | Fake bridge supports `chat-info`; current production CDP bridge returns `unsupported action chat-info`. | Real CDP/native bridge support still missing. |
| Join | join group as admin/member/read-only | `blocked: missing fixture` | Not tested in production. Current UAT lacks dedicated identities and right variants. | Needs Dev/Stage A/B identities, disposable groups and explicit admin/member/read-only setup. |
| Allowlist | allowlisted group sender | `pass` | `Plak\nAdmin` style sender labels are normalized before alias/allowlist checks. | 0.1.19 tests and production Canary poll/process. |
| Allowlist | disallowed group sender | `covered by harness` | Unit tests cover rejection path; not tested live because it requires changing allowlists or alternate identities. | Use Dev/Stage fixtures, not production. |
| Echo guard | ignore `K OpenClaw` echo rows | `pass` | Tests cover echo filtering; live poll did not replay own OpenClaw rows as inbound. | `tests/keet-cdp-bridge.test.ts`, bridge poll. |
| Wrong-room guard | active room mismatch before/after send | `pass` | Tests cover fail-closed behavior; previous production duplicate issue was fixed by retry idempotency. | `tests/keet-cdp-bridge.test.ts`, #28 evidence. |
| Duplicate guard | retry of already visible send | `pass` | 0.1.18 gate proved duplicate retry fix; 0.1.19 normal DM/group UAT produced one matching row each. | #28 evidence, current DOM readback. |
| Status guard | internal OpenClaw status/progress text | `pass` | `Model Fallback:` text is blocked before Keet delivery. | `OutboundDeliveryError` and DOM no-match. |
| Restart | old rows not replayed after restart | `covered by harness` | Existing UAT matrix requires this, but no restart was performed in this 0.1.19 test slice. | Needs separate restart gate. |
| Recovery | plugin backup/rollback path | `covered by harness` | Release docs define rollback. Not exercised in this test-only slice. | Exercise only during install/restart gates. |

## Release Candidate Baseline

Future release candidates should use this file as the baseline checklist:

1. Keep the `pass` rows green with fresh evidence.
2. Convert `covered by harness` rows into real Dev/Stage proof where practical.
3. Do not run `not executed: destructive` rows in production. Build disposable
   Dev/Stage rooms first.
4. Turn each `not supported` row into either an explicit product non-goal or a
   separate implementation issue.
5. Do not call a production gate green while `openclaw message read --channel
   keet` still fails, unless a narrower gate explicitly accepts CDP DOM readback
   as the visible-read proof.

## Immediate Follow-Up Candidates

| Candidate | Reason |
|---|---|
| Fix Keet `message read` CLI path | Current send/poll/channel health works, but `message read` fails with `Channel keet is unavailable for message actions (plugin not loaded)`. |
| Implement or explicitly defer real `invite` and `chat-info` in the CDP bridge | The public bridge contract names them, but current CDP production bridge only supports `send` and `poll`. |
| Provision Dev/Stage persistent Keet identities and disposable rooms | Required before join-rights and delete/group-delete UAT can be run safely. |
| Specify destructive action semantics | Delete message, delete group chat, leave group, edit, react and pin need product decisions before bridge work. |
