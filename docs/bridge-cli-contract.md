# Keet Bridge CLI Contract

The public OpenClaw plugin boundary is a local bridge command. The plugin never
imports Keet Desktop internals, Pear runtime state or Holepunch key material
directly.

## Commands

### send

```bash
keet-bridge send --chat <conversation-id-or-name> --text <message-text> [--reply-to <message-id>]
```

The bridge returns JSON on stdout:

```json
{
  "ok": true,
  "send": {
    "latestOutgoing": {
      "id": "message-id",
      "chat": "conversation-id-or-name",
      "replyToId": "message-id-being-answered"
    }
  }
}
```

`--reply-to` is optional. When present, the bridge SHOULD use the native Keet
reply/quote action for that message id before sending. If the active Keet
client build cannot expose a native reply affordance, the bridge MAY still send
the message without `replyToId` in `latestOutgoing`; the absence is explicit
evidence that native quote selection was not preserved for that send.

UI-backed bridge adapters MUST fail closed when the active room cannot be
verified as the requested `--chat` target immediately before reply selection,
immediately before focusing the composer and immediately after the send. The
returned `latestOutgoing` id MUST be read from that verified target room, not
from a stale or merely currently visible message row.

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

Because the plugin poll command intentionally has no `--chat` argument, local
bridge adapters MUST derive enabled direct and group polling targets from their
own local configuration. A CDP adapter that opens Keet Desktop chats SHOULD
prefer sidebar room-list entries over generic text matches so that a direct
peer name visible inside a group history does not select the wrong chat.

### read

```bash
keet-bridge read --chat <conversation-id-or-name> --limit <1-100>
```

The bridge returns JSON on stdout:

```json
{
  "ok": true,
  "read": {
    "chat": "conversation-id-or-name",
    "messages": [
      {
        "id": "message-id",
        "chatType": "group",
        "chat": "conversation-id-or-name",
        "direction": "incoming",
        "sender": "plak0815",
        "text": "visible message body",
        "timestampMs": 1786513700000
      }
    ]
  }
}
```

`read` is a read-only message action. UI-backed bridge adapters MUST verify the
requested room before reading rows and MUST return only the latest visible
bounded row set when the provider exposes a virtualized DOM.

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
can replace it as long as it keeps the same `send`, `poll`, `read`, `invite` and
`chat-info` JSON contract.
