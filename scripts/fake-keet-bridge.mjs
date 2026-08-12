#!/usr/bin/env node
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "node:path";

function parseArgs(argv) {
  const [action, ...rest] = argv;
  const params = { action };
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
    if (value === undefined) {
      throw new Error(`missing value for ${key}`);
    }
    if (key === "--chat") {
      params.chat = value;
    } else if (key === "--text") {
      params.text = value;
    } else if (key === "--account") {
      params.account = value;
    } else if (key === "--limit") {
      params.limit = Number(value);
    } else if (key === "--cursor") {
      params.cursor = value;
    } else if (key === "--ttl-days") {
      params.ttlDays = Number(value);
    } else if (key === "--member") {
      params.members = [...(params.members ?? []), value];
    } else {
      throw new Error(`unsupported option ${key}`);
    }
  }
  return params;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableMessageId(params) {
  return `fake-keet-${sha256(`${params.chat}\0${params.text}`).slice(0, 24)}`;
}

function stableInviteLink(params) {
  return `keet://invite/fake-${sha256(`${params.chat}\0${params.ttlDays}`).slice(0, 32)}`;
}

function redactedArgv(argv) {
  const redacted = [];
  for (let i = 0; i < argv.length; i += 1) {
    redacted.push(argv[i] === "--text" ? argv[i] : argv[i - 1] === "--text" ? "<redacted>" : argv[i]);
  }
  return redacted;
}

const params = parseArgs(process.argv.slice(2));

const logPath = process.env.KEET_FAKE_BRIDGE_LOG;

async function appendEvidence(evidence) {
  if (logPath) {
    await mkdir(dirname(logPath), { recursive: true, mode: 0o700 });
    await appendFile(logPath, `${JSON.stringify(evidence)}\n`, { mode: 0o600 });
  }
}

if (params.action === "send") {
  if (!params.chat || !params.chat.trim()) {
    throw new Error("fake Keet bridge requires --chat");
  }
  if (!params.text || !params.text.trim()) {
    throw new Error("fake Keet bridge requires --text");
  }

  const messageId = stableMessageId(params);
  await appendEvidence({
    kind: "fake-keet-bridge-send",
    action: params.action,
    chat: params.chat,
    argv: redactedArgv(process.argv.slice(2)),
    textSha256: sha256(params.text),
    textLength: params.text.length,
    messageId,
    realKeetTouched: false,
    createdAt: new Date().toISOString(),
  });

  process.stdout.write(`${JSON.stringify({
    ok: true,
    fake: true,
    send: {
      latestOutgoing: {
        id: messageId,
        chat: params.chat,
      },
    },
  })}\n`);
} else if (params.action === "poll") {
  if (!params.account || !params.account.trim()) {
    throw new Error("fake Keet bridge requires --account");
  }
  const limit = Number.isInteger(params.limit) && params.limit > 0 ? params.limit : 50;
  const cursorIndex = params.cursor && /^\d+$/.test(params.cursor) ? Number(params.cursor) : 0;
  const eventPath = process.env.KEET_FAKE_BRIDGE_EVENTS;
  const lines = eventPath
    ? (await readFile(eventPath, "utf8")).split("\n").filter((line) => line.trim())
    : [];
  const events = lines.slice(cursorIndex, cursorIndex + limit).map((line) => JSON.parse(line));
  const nextCursor = String(cursorIndex + events.length);

  await appendEvidence({
    kind: "fake-keet-bridge-poll",
    action: params.action,
    account: params.account,
    limit,
    cursor: params.cursor ?? null,
    eventCount: events.length,
    eventIds: events.map((event) => event.id ?? event.messageId).filter(Boolean),
    realKeetTouched: false,
    createdAt: new Date().toISOString(),
  });

  process.stdout.write(`${JSON.stringify({
    ok: true,
    fake: true,
    poll: {
      cursor: nextCursor,
      events,
    },
  })}\n`);
} else if (params.action === "invite") {
  if (!params.chat || !params.chat.trim()) {
    throw new Error("fake Keet bridge requires --chat");
  }
  const ttlDays = Number.isInteger(params.ttlDays) && params.ttlDays > 0 ? params.ttlDays : 14;
  if (ttlDays > 14) {
    throw new Error("fake Keet bridge invite ttl must be <= 14 days");
  }
  const inviteLink = stableInviteLink({ chat: params.chat, ttlDays });

  await appendEvidence({
    kind: "fake-keet-bridge-invite",
    action: params.action,
    chat: params.chat,
    ttlDays,
    inviteSha256: sha256(inviteLink),
    realKeetTouched: false,
    createdAt: new Date().toISOString(),
  });

  process.stdout.write(`${JSON.stringify({
    ok: true,
    fake: true,
    invite: {
      chat: params.chat,
      ttlDays,
      link: inviteLink,
      qrPayload: inviteLink,
    },
  })}\n`);
} else if (params.action === "chat-info") {
  if (!params.chat || !params.chat.trim()) {
    throw new Error("fake Keet bridge requires --chat");
  }
  const members = params.members ?? [];

  await appendEvidence({
    kind: "fake-keet-bridge-chat-info",
    action: params.action,
    chat: params.chat,
    memberCount: members.length,
    memberIds: members,
    realKeetTouched: false,
    createdAt: new Date().toISOString(),
  });

  process.stdout.write(`${JSON.stringify({
    ok: true,
    fake: true,
    chatInfo: {
      chat: params.chat,
      memberCount: members.length,
      members,
    },
  })}\n`);
} else {
  throw new Error("fake Keet bridge only supports send, poll, invite and chat-info");
}
