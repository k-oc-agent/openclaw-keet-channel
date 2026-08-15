# Current Version UAT Report: 0.1.20

Issue: `Plak/openclaw-keet-channel#32`

Version under test: `@plak/openclaw-keet-channel@0.1.20`

Date: 2026-08-15

## Scope

This report is the public ClawHub release snapshot for the current production
version. It records what is proven, what is only covered by harness/tests, and
what is not implemented or not safe to run against production Keet state.

The production bridge is a local Keet Desktop CDP bridge candidate. It is good
enough for the explicitly tested OpenClaw text channel flows below, but it is
not a complete Keet client automation surface.

## Evidence Summary

| Evidence | Result |
|---|---|
| Repo check | `npm run check` passed: 75 tests. |
| Audit | `npm audit --omit=dev` found 0 vulnerabilities. |
| Production install readback | `openclaw plugins inspect keet` loaded version `0.1.20` from `/tmp/keet-pack-20260815-0120-TLYJvM/plak-openclaw-keet-channel-0.1.20.tgz`. |
| Gateway/channel health | `openclaw-gateway.service` active/running, MainPID `1743733`, `NRestarts=0`; Keet channel healthy in `bridge-poll` mode. |
| DM outbound | 0.1.19 UAT and 0.1.20 readback show the configured Plak DM target works; duplicate retry guard remains green from #28. |
| Canary group outbound | 0.1.19 UAT showed a normal Canary group send reached the target room exactly once. |
| Canary group inbound | 0.1.19 prod gate showed allowlisted Canary group inbound processing and visible reply delivery. |
| Message read | 0.1.20 prod gate fixed the former `plugin not loaded` read bug; `openclaw message read --channel keet` returned `handledBy=plugin`, `payload.ok=true` for Canary and Plak DM reads. |
| Status leak guard | Internal OpenClaw status/progress text such as `Model Fallback:` fails closed before Keet delivery. |

## Function Matrix

| Area | User journey / function | 0.1.20 status | Current result | Next gate |
|---|---|---|---|---|
| Install | Install/readback current package | `pass` | Production loads `0.1.20` from the expected archive. | Keep exact version/readback in every release gate. |
| Health | Gateway and channel health | `pass` | Gateway active, Keet running/connected/healthy in `bridge-poll`. | Keep health check in every release gate. |
| Outbound DM | normal DM send | `pass` | Configured Plak DM target works; duplicate retry guard prevents repeated visible rows. | Fresh DM send smoke for each release candidate. |
| Outbound group | normal Canary group send | `pass` | Configured Canary group target works with wrong-room guard. | Fresh group send smoke for each release candidate. |
| Inbound poll | Direct bridge poll | `pass` | Poll emits allowlisted direct rows from `plak0815`. | Keep allowlist proof. |
| Inbound poll | Group bridge poll | `pass` | Poll emits Canary group rows after sender role normalization. | Keep allowlist and role-normalization proof. |
| Processing | Canary group inbound processing | `pass` | OpenClaw processed Canary inbound and sent a visible Keet reply. | Fresh processing smoke for each release candidate. |
| Read | `openclaw message read --channel keet` | `pass` | Read is handled by the plugin and returns bounded visible rows for group and DM targets. | Track room-switch flakes separately if they recur. |
| Reply | Reply to inbound group message | `pass` | Existing production gate preserved `replyTo` context for Canary processing. | Capture native quote DOM structure in future RC gates. |
| Reply | native quote reply visual structure | `covered by harness` | Dev/Stage and tests cover native quote structure; current 0.1.20 prod read gate did not re-check quote DOM. | Add explicit prod quote DOM proof if required. |
| Forward | Forward menu during reply selection | `pass` | Forward menu entries fail closed instead of being mistaken for Reply. | Keep regression test. |
| Forward | User-facing message Forward | `not supported` | No OpenClaw Keet forward action exists. | Needs product spec and real UAT fixtures. |
| Invite | Generate group invite | `covered by harness` | Fake bridge covers contract; current CDP bridge does not implement real invite generation. | Real bridge support plus secret-safe evidence. |
| Membership | `chat-info` group membership readback | `covered by harness` | Fake bridge covers contract; current CDP bridge does not implement real `chat-info`. | Real bridge support plus disposable rooms. |
| Join | join group as admin/member/read-only | `blocked: missing fixture` | Not tested; requires dedicated Dev/Stage identities and right-variant rooms. | Provision fixtures before implementation/claim. |
| Delete | delete own message | `not executed: destructive` | Not run against production Keet history; no current user-facing delete action. | Disposable UAT room and explicit semantics. |
| Delete | delete another user's message | `not executed: destructive` | Not run; destructive and rights-sensitive. | Admin/non-admin fixtures. |
| Delete | delete group chat | `not executed: destructive` | Not run; destructive to room state and not implemented. | Disposable group and rollback contract. |
| Edit | Edit sent message | `not supported` | No Keet edit action exists. | Product decision and bridge contract. |
| Reactions | React to message | `not supported` | No Keet reaction action exists. | Product decision and bridge contract. |
| Pins | Pin/unpin message | `not supported` | No Keet pin action exists. | Product decision and bridge contract. |
| Media | Send attachment/media | `not supported` | Current Keet adapter is text-only. | Media contract and real evidence. |
| Restart | Old rows not replayed after restart | `covered by harness` | Cursor/dedupe behavior is tested, but not re-smoked in the 0.1.20 prod gate. | Separate restart gate. |
| Recovery | Keet profile recovery | `not supported` | Recovery phrases and profile mutation are intentionally outside the plugin. | Keep secrets outside repo/chat. |

## Public Release Summary

This is an alpha/WIP OpenClaw channel plugin for Keet. It is suitable only for
explicitly configured, allowlisted text-channel flows through a local bridge
command. It is not a general-purpose Keet automation client and it does not
support destructive or rich-message journeys yet.
