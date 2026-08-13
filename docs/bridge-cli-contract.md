# Keet Bridge CLI Contract

The public OpenClaw plugin boundary is a local bridge command. The plugin never
imports Keet Desktop internals, Pear runtime state or Holepunch key material
directly.

## Commands

### send

```bash
keet-bridge send --chat <conversation-id-or-name> --text <message-text>
```

The bridge returns JSON on stdout:

```json
{
  "ok": true,
  "send": {
    "latestOutgoing": {
      "id": "message-id",
      "chat": "conversation-id-or-name"
    }
  }
}
```

### poll

```bash
keet-bridge poll --account <account-id> --limit <1-100> [--cursor <cursor>]
```

The bridge returns JSON on stdout:

```json
{
  "ok": true,
  "poll": {
    "cursor": "next-cursor",
    "events": [
      {
        "id": "message-id",
        "chatType": "direct",
        "chat": "plak0815",
        "sender": "plak0815",
        "text": "transient message text",
        "timestampMs": 1786513700000
      }
    ]
  }
}
```

`chatType` is `direct` or `group`. The plugin normalizes `chat` to
`conversationId`, `sender` to `senderId`, and `id` to `messageId`.

Bridge adapters that read a virtualized UI, such as Keet Desktop through CDP,
MUST NOT treat `cursor` as an index into a virtualized DOM window. They should
return the latest visible bounded event set and rely on the plugin's persisted
message-id dedupe state for idempotency. Adapters MUST filter visible `K OpenClaw` echo rows
before emitting inbound events, otherwise OpenClaw's own delivery/status
messages can be replayed as Plak inbound.

### invite

```bash
keet-bridge invite --chat <conversation-id-or-name> --ttl-days <1-14>
```

The bridge returns JSON on stdout for immediate operator handoff:

```json
{
  "ok": true,
  "invite": {
    "chat": "conversation-id-or-name",
    "ttlDays": 14,
    "link": "keet://invite/...",
    "qrPayload": "keet://invite/..."
  }
}
```

The invite link or QR payload is transient output only. Evidence files may store
hashes and metadata, never the raw invite.

### chat-info

```bash
keet-bridge chat-info --chat <conversation-id-or-name>
```

The bridge returns JSON on stdout:

```json
{
  "ok": true,
  "chatInfo": {
    "chat": "conversation-id-or-name",
    "memberCount": 2,
    "members": ["k-oc", "plak0815"]
  }
}
```

Use `chat-info` after a Canary invite to verify the room reached the expected
membership count before enabling or testing production routing.

## Security Boundary

- No recovery phrases, invite secrets, QR contents, raw key material or backup
  passwords may be passed through this contract.
- The bridge may emit transient message text on stdout for delivery, but the
  plugin MUST NOT persist raw message text in state or evidence.
- The bridge may emit transient invite links or QR payloads on stdout for
  operator handoff, but it MUST NOT persist invite links or QR payloads in
  state, logs or evidence.
- Persistent inbound state stores message ids, route metadata, hashes and
  lengths only.
- Production direct messages must use `dmPolicy: "allowlist"` with explicit
  senders such as `plak0815`.
- `allowFrom: ["*"]` is not valid for the first public release scope.

## Adapter Strategy

The first implementation may use a local Keet Desktop/CDP bridge adapter. That
adapter is not the public plugin contract. A later native Pear/Holepunch bridge
can replace it as long as it keeps the same `send`, `poll`, `invite` and
`chat-info` JSON contract.
