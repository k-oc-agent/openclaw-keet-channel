# Changelog

## 0.1.4

- Re-publish the `0.1.3` Keet target resolver fix after ClawHub reserved
  `0.1.3` without making it visible or installable.
- No runtime code change from `0.1.3`.

## 0.1.3

- Resolve Keet message targets through the OpenClaw messaging adapter.
- Support bare allowlisted handles, explicit Keet direct targets, group targets
  and OpenClaw runtime direct-session locators.

## 0.1.2

- Reject foreign OpenClaw channel locators before invoking the Keet bridge.
- Document the corrected Dev/Stage gateway lifecycle proof for the current
  release state.
- Keep `0.1.1` as the gateway-native lifecycle baseline and use `0.1.2` for
  the target-guarded internal release.

## 0.1.1

- Add gateway-native Keet account lifecycle with bridge polling.
- Dispatch allowlisted inbound Keet events through the OpenClaw channel
  runtime instead of relying only on the external timer bridge.
- Report runtime health/activity from the plugin account lifecycle.

## 0.1.0

- Add OpenClaw channel plugin metadata for Keet.
- Add bridge-CLI outbound send transport.
- Add bridge-CLI inbound poll transport.
- Add allowlist-first inbound routing, dedupe and redacted state records.
- Document public bridge contract, security boundary and rollback path.
