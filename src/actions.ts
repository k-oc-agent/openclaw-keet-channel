import {
  type ChannelPlugin,
  jsonResult,
  readStringParam,
} from "openclaw/plugin-sdk/core";

import { resolveKeetAccount } from "./config.js";
import {
  readMessagesWithBridgeCli,
  type KeetReadResult,
} from "./transport.js";

type KeetReadContext = {
  cfg: unknown;
  accountId?: string | null;
  params: Record<string, unknown>;
};

type KeetMessageActionAdapter = NonNullable<ChannelPlugin["actions"]>;

export type KeetMessageActionsDeps = {
  readMessages?: (ctx: {
    cfg: unknown;
    to: string;
    limit?: number;
    accountId?: string | null;
  }) => Promise<KeetReadResult>;
};

function readTargetParam(params: Record<string, unknown>): string {
  return readStringParam(params, "target")
    ?? readStringParam(params, "to")
    ?? readStringParam(params, "channelId")
    ?? readStringParam(params, "chatId")
    ?? "";
}

function readLimitParam(params: Record<string, unknown>): number {
  const value = params.limit;
  if (value == null || value === "") {
    return 50;
  }
  const numeric = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(numeric) || numeric < 1) {
    throw new Error("limit must be a positive integer");
  }
  return numeric;
}

async function defaultReadMessages(ctx: {
  cfg: unknown;
  to: string;
  limit?: number;
  accountId?: string | null;
}): Promise<KeetReadResult> {
  const account = resolveKeetAccount(ctx.cfg, ctx.accountId);
  if (!account.bridgeCommand) {
    throw new Error("Keet bridgeCommand is required for message read");
  }
  return readMessagesWithBridgeCli({
    bridgeCommand: account.bridgeCommand,
    to: ctx.to,
    limit: ctx.limit,
  });
}

async function handleRead(ctx: KeetReadContext, deps: KeetMessageActionsDeps): Promise<ReturnType<typeof jsonResult>> {
  const to = readTargetParam(ctx.params);
  if (!to) {
    throw new Error("Keet read requires a target");
  }
  const limit = readLimitParam(ctx.params);
  if (limit > 100) {
    throw new Error("Keet read limit must be an integer from 1 to 100");
  }
  const readMessages = deps.readMessages ?? defaultReadMessages;
  const result = await readMessages({
    cfg: ctx.cfg,
    to,
    limit,
    accountId: ctx.accountId,
  });
  return jsonResult({
    ok: true,
    channel: "keet",
    action: "read",
    target: to,
    conversationId: result.conversationId,
    messages: result.messages,
  });
}

export function createKeetMessageActions(deps: KeetMessageActionsDeps = {}): KeetMessageActionAdapter {
  return {
    describeMessageTool: () => ({
      actions: ["read"],
      capabilities: [],
    }),
    supportsAction: ({ action }) => action === "read",
    resolveExecutionMode: () => "local",
    handleAction: async (ctx) => {
      if (ctx.action === "read") {
        return handleRead(ctx, deps);
      }
      throw new Error(`Action ${ctx.action} is not supported for provider keet.`);
    },
  };
}

export const keetMessageActions: KeetMessageActionAdapter = createKeetMessageActions();
