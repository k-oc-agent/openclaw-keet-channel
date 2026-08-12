# Canary Invite / Join Runbook

Issue: `Plak/openclaw-keet-channel#7`

This runbook fixes the rough Canary onboarding path found during the first real
Keet room test. The visible `Invite peer to chat` control can open a QR import
flow; the reproducible UI path is:

```text
Group info -> Share invite link -> Generate new link
```

## Goal

Generate a short-lived invite for a separate Canary room, hand it to Plak, then
read back membership before any production target is enabled.

## Bridge Commands

Generate an invite:

```bash
keet-bridge invite --chat "K OC Keet Canary <date>" --ttl-days 14
```

Verify that Plak joined:

```bash
keet-bridge chat-info --chat "K OC Keet Canary <date>"
```

Pass condition:

```text
memberCount >= 2
```

Expected members are the local K/OpenClaw Keet identity and Plak's Keet peer.

## Evidence Rules

- Do not paste invite links into GitLab, Git, memory files or general logs.
- Do not store QR payloads in GitLab, Git, memory files or general logs.
- Persist only redacted evidence: chat name, TTL, invite hash, member count,
  member IDs if needed, timestamps and `realKeetTouched`.
- Use a separate Canary room. Do not use the existing Plak direct chat for join
  experiments.
- Production Keet groups or Plak's direct production chat still require a
  separate explicit Plak gate.

## Safe Stop

If invite generation, QR handoff or membership readback is ambiguous, stop with
the ticket still open and record only the non-secret failure evidence. Do not
retry by sending into the production direct chat.
