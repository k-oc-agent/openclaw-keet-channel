# Changelog

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
