import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type BridgeCliRun = (argv: string[]) => Promise<{ stdout: string }>;

export type BridgeCliSendParams = {
  bridgeCommand: string;
  to: string;
  text: string;
  replyToId?: string | null;
  signal?: AbortSignal;
  run?: BridgeCliRun;
};

export type BridgeCliPollParams = {
  bridgeCommand: string;
  accountId: string;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
  run?: BridgeCliRun;
};

export type BridgeCliReadParams = {
  bridgeCommand: string;
  to: string;
  limit?: number;
  signal?: AbortSignal;
  run?: BridgeCliRun;
};

export type KeetSendReceipt = {
  messageId: string;
  conversationId: string;
  raw?: unknown;
};

export type KeetPolledInboundEvent = {
  accountId: string;
  chatType: "direct" | "group";
  conversationId: string;
  senderId: string;
  messageId?: string;
  text: string;
  timestampMs?: number;
  mentioned?: boolean;
};

export type KeetPollResult = {
  cursor?: string;
  events: KeetPolledInboundEvent[];
  raw?: unknown;
};

export type KeetReadMessage = {
  messageId: string;
  conversationId: string;
  chatType?: "direct" | "group";
  direction?: "incoming" | "outgoing" | "unknown";
  senderId?: string;
  text: string;
  timestampMs?: number;
  raw?: unknown;
};

export type KeetReadResult = {
  conversationId: string;
  messages: KeetReadMessage[];
  raw?: unknown;
};

type BridgeCliArgsParams = {
  bridgeCommand: string;
  action: "send";
  to: string;
  text: string;
  replyToId?: string | null;
} | {
  bridgeCommand: string;
  action: "poll";
  accountId: string;
  cursor?: string | null;
  limit?: number;
} | {
  bridgeCommand: string;
  action: "read";
  to: string;
  limit?: number;
};

function rejectEmptyTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new Error("Keet target is required");
  }
  return trimmed;
}

export function normalizeKeetSendTarget(target: string): string {
  const trimmed = rejectEmptyTarget(target);
  if (trimmed.startsWith("channel:keet:")) {
    const parts = trimmed.split(":");
    const chatType = parts[3];
    const conversationId = parts.slice(4).join(":").trim();
    if ((chatType === "direct" || chatType === "group") && conversationId) {
      return conversationId;
    }
    throw new Error("Keet target must be a Keet conversation target");
  }
  if (trimmed.startsWith("keet:group:")) {
    return rejectEmptyTarget(trimmed.slice("keet:group:".length));
  }
  if (trimmed.startsWith("keet:direct:")) {
    return rejectEmptyTarget(trimmed.slice("keet:direct:".length));
  }
  if (trimmed.startsWith("keet:")) {
    return rejectEmptyTarget(trimmed.slice("keet:".length));
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    throw new Error("Keet target must be a Keet conversation target");
  }
  return trimmed;
}

export function buildBridgeCliArgs(params: BridgeCliArgsParams): string[] {
  if (!params.bridgeCommand.trim()) {
    throw new Error("Keet bridgeCommand is required");
  }
  if (params.action === "poll") {
    if (!params.accountId.trim()) {
      throw new Error("Keet account is required");
    }
    const limit = params.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("Keet poll limit must be an integer from 1 to 100");
    }
    const argv = [
      params.bridgeCommand,
      params.action,
      "--account",
      params.accountId,
      "--limit",
      String(limit),
    ];
    if (params.cursor?.trim()) {
      argv.push("--cursor", params.cursor);
    }
    return argv;
  }
  if (params.action === "read") {
    const to = normalizeKeetSendTarget(params.to);
    const limit = params.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("Keet read limit must be an integer from 1 to 100");
    }
    return [
      params.bridgeCommand,
      params.action,
      "--chat",
      to,
      "--limit",
      String(limit),
    ];
  }
  const to = normalizeKeetSendTarget(params.to);
  if (!params.text.trim()) {
    throw new Error("Keet text is required");
  }

  const argv = [params.bridgeCommand, params.action, "--chat", to, "--text", params.text];
  if (params.replyToId?.trim()) {
    argv.push("--reply-to", params.replyToId);
  }
  return argv;
}

async function defaultRun(argv: string[], signal?: AbortSignal): Promise<{ stdout: string }> {
  const [command, ...args] = argv;
  return execFileAsync(command, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    signal,
    timeout: 60_000,
  });
}

function parseBridgeReceipt(stdout: string, fallbackConversationId: string): KeetSendReceipt {
  const payload = JSON.parse(stdout) as {
    send?: {
      latestOutgoing?: {
        id?: unknown;
        messageId?: unknown;
        chat?: unknown;
      };
    };
  };
  const latest = payload.send?.latestOutgoing;
  const messageId = typeof latest?.id === "string"
    ? latest.id
    : typeof latest?.messageId === "string"
      ? latest.messageId
      : undefined;
  if (!messageId) {
    throw new Error("Keet bridge did not return a message id");
  }
  return {
    messageId,
    conversationId: typeof latest?.chat === "string" ? latest.chat : fallbackConversationId,
    raw: latest,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function timestampField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanField(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeBridgePollEvent(value: unknown, accountId: string): KeetPolledInboundEvent {
  const raw = asRecord(value);
  const chatType = raw.chatType === "group" ? "group" : "direct";
  const conversationId = stringField(raw.conversationId) ?? stringField(raw.chat);
  const senderId = stringField(raw.senderId) ?? stringField(raw.sender);
  const text = stringField(raw.text);
  if (!conversationId) {
    throw new Error("Keet bridge poll event is missing conversation id");
  }
  if (!senderId) {
    throw new Error("Keet bridge poll event is missing sender id");
  }
  if (!text) {
    throw new Error("Keet bridge poll event is missing text");
  }
  return {
    accountId,
    chatType,
    conversationId,
    senderId,
    messageId: stringField(raw.messageId) ?? stringField(raw.id),
    text,
    timestampMs: timestampField(raw.timestampMs),
    mentioned: booleanField(raw.mentioned),
  };
}

function parseBridgePoll(stdout: string, accountId: string): KeetPollResult {
  const payload = JSON.parse(stdout) as unknown;
  const root = asRecord(payload);
  const poll = asRecord(root.poll);
  const events = Array.isArray(poll.events)
    ? poll.events.map((event) => normalizeBridgePollEvent(event, accountId))
    : [];
  return {
    cursor: stringField(poll.cursor),
    events,
    raw: poll,
  };
}

function directionField(value: unknown): "incoming" | "outgoing" | "unknown" | undefined {
  if (value === "incoming" || value === "outgoing" || value === "unknown") {
    return value;
  }
  return undefined;
}

function normalizeBridgeReadMessage(value: unknown, fallbackConversationId: string): KeetReadMessage {
  const raw = asRecord(value);
  const conversationId = stringField(raw.conversationId) ?? stringField(raw.chat) ?? fallbackConversationId;
  const messageId = stringField(raw.messageId) ?? stringField(raw.id);
  const text = stringField(raw.text);
  if (!messageId) {
    throw new Error("Keet bridge read message is missing message id");
  }
  if (!text) {
    throw new Error("Keet bridge read message is missing text");
  }
  return {
    messageId,
    conversationId,
    chatType: raw.chatType === "group" ? "group" : raw.chatType === "direct" ? "direct" : undefined,
    direction: directionField(raw.direction),
    senderId: stringField(raw.senderId) ?? stringField(raw.sender),
    text,
    timestampMs: timestampField(raw.timestampMs),
    raw,
  };
}

function parseBridgeRead(stdout: string, fallbackConversationId: string): KeetReadResult {
  const payload = JSON.parse(stdout) as unknown;
  const root = asRecord(payload);
  const read = asRecord(root.read);
  const conversationId = stringField(read.conversationId) ?? stringField(read.chat) ?? fallbackConversationId;
  const messages = Array.isArray(read.messages)
    ? read.messages.map((message) => normalizeBridgeReadMessage(message, conversationId))
    : [];
  return {
    conversationId,
    messages,
    raw: read,
  };
}

export async function sendTextWithBridgeCli(params: BridgeCliSendParams): Promise<KeetSendReceipt> {
  const argv = buildBridgeCliArgs({
    bridgeCommand: params.bridgeCommand,
    action: "send",
    to: params.to,
    text: params.text,
    replyToId: params.replyToId,
  });
  const result = params.run ? await params.run(argv) : await defaultRun(argv, params.signal);
  return parseBridgeReceipt(result.stdout, params.to);
}

export async function pollInboundWithBridgeCli(params: BridgeCliPollParams): Promise<KeetPollResult> {
  const argv = buildBridgeCliArgs({
    bridgeCommand: params.bridgeCommand,
    action: "poll",
    accountId: params.accountId,
    cursor: params.cursor,
    limit: params.limit,
  });
  const result = params.run ? await params.run(argv) : await defaultRun(argv, params.signal);
  return parseBridgePoll(result.stdout, params.accountId);
}

export async function readMessagesWithBridgeCli(params: BridgeCliReadParams): Promise<KeetReadResult> {
  const to = normalizeKeetSendTarget(params.to);
  const argv = buildBridgeCliArgs({
    bridgeCommand: params.bridgeCommand,
    action: "read",
    to,
    limit: params.limit,
  });
  const result = params.run ? await params.run(argv) : await defaultRun(argv, params.signal);
  return parseBridgeRead(result.stdout, to);
}
