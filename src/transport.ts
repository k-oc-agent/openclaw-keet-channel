import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type BridgeCliRun = (argv: string[]) => Promise<{ stdout: string }>;

export type BridgeCliSendParams = {
  bridgeCommand: string;
  to: string;
  text: string;
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

type BridgeCliArgsParams = {
  bridgeCommand: string;
  action: "send";
  to: string;
  text: string;
} | {
  bridgeCommand: string;
  action: "poll";
  accountId: string;
  cursor?: string | null;
  limit?: number;
};

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
  if (!params.to.trim()) {
    throw new Error("Keet target is required");
  }
  if (!params.text.trim()) {
    throw new Error("Keet text is required");
  }

  return [params.bridgeCommand, params.action, "--chat", params.to, "--text", params.text];
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

export async function sendTextWithBridgeCli(params: BridgeCliSendParams): Promise<KeetSendReceipt> {
  const argv = buildBridgeCliArgs({
    bridgeCommand: params.bridgeCommand,
    action: "send",
    to: params.to,
    text: params.text,
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
