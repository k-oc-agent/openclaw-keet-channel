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

export type KeetSendReceipt = {
  messageId: string;
  conversationId: string;
  raw?: unknown;
};

export function buildBridgeCliArgs(params: {
  bridgeCommand: string;
  action: "send";
  to: string;
  text: string;
}): string[] {
  if (!params.bridgeCommand.trim()) {
    throw new Error("Keet bridgeCommand is required");
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
