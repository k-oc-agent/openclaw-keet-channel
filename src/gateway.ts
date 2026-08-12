import {
  createAccountStatusSink,
  runPassiveAccountLifecycle,
} from "openclaw/plugin-sdk/channel-lifecycle";
import type { ChannelAccountSnapshot, OpenClawConfig } from "openclaw/plugin-sdk/core";

import type { KeetAccountConfig } from "./config.js";
import type { KeetInboundDelivery, KeetInboundStateRecord } from "./inbound.js";
import {
  pollKeetInboundBatch,
  type KeetInboundPollBatch,
  type KeetInboundPollBatchParams,
} from "./poller.js";
import { sendTextWithBridgeCli } from "./transport.js";

export type KeetGatewayStatusSink = (patch: Omit<ChannelAccountSnapshot, "accountId">) => void;

export type KeetGatewayPollState = {
  cursor?: string;
  seenKeys: Set<string>;
};

export type KeetDeliveryDispatchContext = {
  cfg: OpenClawConfig;
  account: KeetAccountConfig;
  accountId: string;
  delivery: KeetInboundDelivery;
  channelRuntime?: unknown;
  abortSignal?: AbortSignal;
  setStatus?: KeetGatewayStatusSink;
  now?: () => number;
};

export type KeetGatewayPollDeps = {
  pollBatch?: (params: KeetInboundPollBatchParams) => Promise<KeetInboundPollBatch>;
  dispatchDelivery?: (ctx: KeetDeliveryDispatchContext) => Promise<void>;
  now?: () => number;
};

export type KeetGatewayPollParams = {
  cfg: OpenClawConfig;
  account: KeetAccountConfig;
  accountId: string;
  state: KeetGatewayPollState;
  dispatchMode?: "await" | "detached";
  limit?: number;
  signal?: AbortSignal;
  setStatus?: KeetGatewayStatusSink;
  channelRuntime?: unknown;
  deps?: KeetGatewayPollDeps;
};

export type KeetGatewayPollResult = {
  cursor?: string;
  records: KeetInboundStateRecord[];
  deliveries: number;
};

type KeetGatewayContext = {
  cfg: OpenClawConfig;
  accountId: string;
  account: KeetAccountConfig;
  abortSignal: AbortSignal;
  setStatus: (next: ChannelAccountSnapshot) => void;
  getStatus: () => ChannelAccountSnapshot;
  channelRuntime?: unknown;
  runtime?: {
    error?: (message: string) => void;
    log?: (message: string) => void;
  };
  log?: {
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
};

export type KeetGatewayAdapter = {
  startAccount: (ctx: KeetGatewayContext) => Promise<void>;
  stopAccount: (ctx: KeetGatewayContext) => Promise<void>;
};

type RuntimeRoute = {
  agentId: string;
  sessionKey: string;
};

type RuntimeSurface = {
  routing?: {
    resolveAgentRoute?: (params: {
      cfg: OpenClawConfig;
      channel: string;
      accountId?: string | null;
      peer?: {
        kind: "direct" | "group";
        id: string;
      };
    }) => RuntimeRoute;
  };
  session?: {
    resolveStorePath?: (store: unknown, params: { agentId: string }) => string;
    recordInboundSession?: unknown;
  };
  inbound?: {
    buildContext?: (params: Record<string, unknown>) => unknown;
    dispatchReply?: (params: Record<string, unknown>) => Promise<unknown>;
  };
  reply?: {
    dispatchReplyWithBufferedBlockDispatcher?: unknown;
  };
};

function runtimeSurface(value: unknown): RuntimeSurface {
  return typeof value === "object" && value !== null ? value as RuntimeSurface : {};
}

function messageText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const text = (payload as { text?: unknown }).text;
  return typeof text === "string" && text.trim() ? text : null;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

async function defaultDispatchDelivery(ctx: KeetDeliveryDispatchContext): Promise<void> {
  const core = runtimeSurface(ctx.channelRuntime);
  const resolveAgentRoute = core.routing?.resolveAgentRoute;
  const buildContext = core.inbound?.buildContext;
  const dispatchReply = core.inbound?.dispatchReply;
  const recordInboundSession = core.session?.recordInboundSession;
  const dispatchReplyWithBufferedBlockDispatcher = core.reply?.dispatchReplyWithBufferedBlockDispatcher;

  if (!resolveAgentRoute || !buildContext || !dispatchReply || !recordInboundSession || !dispatchReplyWithBufferedBlockDispatcher) {
    throw new Error("OpenClaw channelRuntime inbound surface is unavailable");
  }

  const route = resolveAgentRoute({
    cfg: ctx.cfg,
    channel: "keet",
    accountId: ctx.accountId,
    peer: {
      kind: ctx.delivery.chatType,
      id: ctx.delivery.conversationId,
    },
  });
  const storePath = core.session?.resolveStorePath?.((ctx.cfg as { session?: { store?: unknown } }).session?.store, {
    agentId: route.agentId,
  }) ?? "sessions";
  const from = ctx.delivery.chatType === "group"
    ? `keet:group:${ctx.delivery.conversationId}`
    : `keet:${ctx.delivery.senderId}`;
  const to = ctx.delivery.chatType === "group"
    ? `keet:group:${ctx.delivery.conversationId}`
    : `keet:${ctx.delivery.conversationId}`;
  const label = ctx.delivery.chatType === "group"
    ? ctx.delivery.conversationId
    : ctx.delivery.senderId;
  const ctxPayload = buildContext({
    channel: "keet",
    provider: "keet",
    surface: "keet",
    accountId: ctx.accountId,
    messageId: ctx.delivery.messageId,
    timestamp: ctx.delivery.timestampMs,
    from,
    sender: {
      id: ctx.delivery.senderId,
      name: ctx.delivery.senderId,
    },
    conversation: {
      kind: ctx.delivery.chatType,
      id: ctx.delivery.conversationId,
      label,
    },
    route: {
      agentId: route.agentId,
      accountId: ctx.accountId,
      routeSessionKey: route.sessionKey,
      dispatchSessionKey: ctx.delivery.sessionKey,
    },
    reply: {
      to,
      originatingTo: to,
      replyToId: ctx.delivery.messageId,
    },
    message: {
      body: ctx.delivery.text,
      bodyForAgent: ctx.delivery.text,
      rawBody: ctx.delivery.text,
      commandBody: ctx.delivery.text,
    },
    extra: {
      CommandAuthorized: true,
      SenderId: ctx.delivery.senderId,
      WasMentioned: ctx.delivery.chatType === "group" ? true : undefined,
    },
  });

  await dispatchReply({
    channel: "keet",
    accountId: ctx.accountId,
    cfg: ctx.cfg,
    agentId: route.agentId,
    routeSessionKey: route.sessionKey,
    storePath,
    ctxPayload,
    recordInboundSession,
    dispatchReplyWithBufferedBlockDispatcher,
    delivery: {
      durable: () => ({ to: ctx.delivery.conversationId, replyToId: ctx.delivery.messageId }),
      deliver: async (payload: unknown) => {
        const text = messageText(payload);
        if (!text) {
          return { visibleReplySent: false };
        }
        const sent = await sendTextWithBridgeCli({
          bridgeCommand: ctx.account.bridgeCommand!,
          to: ctx.delivery.conversationId,
          text,
          signal: ctx.abortSignal,
        });
        return {
          visibleReplySent: true,
          messageId: sent.messageId,
        };
      },
      onDelivered: () => {
        ctx.setStatus?.({ lastOutboundAt: (ctx.now ?? Date.now)() });
      },
      onError: (error: unknown, info: { kind?: string }) => {
        throw new Error(`Keet ${info.kind ?? "reply"} failed: ${String(error)}`);
      },
    },
  });
}

export async function pollAndDispatchKeetInbound(params: KeetGatewayPollParams): Promise<KeetGatewayPollResult> {
  const now = params.deps?.now ?? Date.now;
  const pollBatch = params.deps?.pollBatch ?? pollKeetInboundBatch;
  const dispatchDelivery = params.deps?.dispatchDelivery ?? defaultDispatchDelivery;
  const batch = await pollBatch({
    cfg: params.cfg,
    accountId: params.accountId,
    cursor: params.state.cursor,
    limit: params.limit,
    seenKeys: params.state.seenKeys,
    signal: params.signal,
  });

  params.state.cursor = batch.cursor;
  params.state.seenKeys = batch.processed.seenKeys;
  params.setStatus?.({
    connected: true,
    running: true,
    healthState: "healthy",
    lastTransportActivityAt: now(),
    lastEventAt: batch.processed.records.length > 0 ? now() : undefined,
    lastInboundAt: batch.processed.deliveries.length > 0 ? now() : undefined,
    lastError: null,
  });

  for (const delivery of batch.processed.deliveries) {
    const deliveryCtx = {
      cfg: params.cfg,
      account: params.account,
      accountId: params.accountId,
      delivery,
      channelRuntime: params.channelRuntime,
      abortSignal: params.signal,
      setStatus: params.setStatus,
      now,
    };
    if (params.dispatchMode === "detached") {
      void dispatchDelivery(deliveryCtx).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        params.setStatus?.({
          healthState: "degraded",
          lastError: message,
        });
      });
      continue;
    }
    await dispatchDelivery(deliveryCtx);
  }

  return {
    cursor: batch.cursor,
    records: batch.processed.records,
    deliveries: batch.processed.deliveries.length,
  };
}

export function createKeetGatewayAdapter(deps: KeetGatewayPollDeps = {}): KeetGatewayAdapter {
  return {
    startAccount: async (ctx) => {
      const setStatus = createAccountStatusSink({
        accountId: ctx.accountId,
        setStatus: ctx.setStatus,
      });
      const pollIntervalMs = 30_000;
      const state: KeetGatewayPollState = {
        seenKeys: new Set(),
      };
      let stopped = false;

      await runPassiveAccountLifecycle({
        abortSignal: ctx.abortSignal,
        start: async () => {
          setStatus({
            running: true,
            connected: true,
            configured: true,
            healthState: "healthy",
            mode: "bridge-poll",
            lastStartAt: Date.now(),
            lastError: null,
          });
          while (!ctx.abortSignal.aborted && !stopped) {
            try {
              await pollAndDispatchKeetInbound({
                cfg: ctx.cfg,
                account: ctx.account,
                accountId: ctx.accountId,
                state,
                dispatchMode: "detached",
                limit: 50,
                signal: ctx.abortSignal,
                setStatus,
                channelRuntime: ctx.channelRuntime,
                deps,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              setStatus({
                connected: false,
                healthState: "degraded",
                lastError: message,
              });
              ctx.log?.warn?.(`[${ctx.accountId}] Keet poll failed: ${message}`);
            }
            await sleep(pollIntervalMs, ctx.abortSignal);
          }
          return undefined;
        },
        stop: () => {
          stopped = true;
        },
        onStop: () => {
          setStatus({
            running: false,
            connected: false,
            lastStopAt: Date.now(),
          });
        },
      });
    },
    stopAccount: async (ctx) => {
      ctx.setStatus({
        ...ctx.getStatus(),
        running: false,
        connected: false,
        lastStopAt: Date.now(),
      });
    },
  };
}
