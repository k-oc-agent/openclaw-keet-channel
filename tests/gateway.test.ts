import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";
import {
  createKeetGatewayAdapter,
  loadKeetGatewayPollState,
  saveKeetGatewayPollState,
  pollAndDispatchKeetInbound,
  type KeetGatewayPollState,
} from "../src/gateway.js";

const cfg = {
  channels: {
    keet: {
      defaultAccount: "default",
      accounts: {
        default: {
          enabled: true,
          bridgeCommand: "/usr/local/bin/keet-bridge",
          dmPolicy: "allowlist",
          allowFrom: ["plak0815"],
        },
      },
    },
  },
};

const account = {
  accountId: "default",
  enabled: true,
  bridgeCommand: "/usr/local/bin/keet-bridge",
  dmPolicy: "allowlist" as const,
  allowFrom: ["plak0815"],
  groups: {},
};

describe("Keet gateway poll lifecycle", () => {
  it("persists only cursor and dedupe keys when a state directory is configured", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keet-gateway-state-"));
    try {
      const statefulAccount = {
        ...account,
        stateDir: dir,
      };
      await saveKeetGatewayPollState(
        statefulAccount,
        {
          cursor: "10",
          seenKeys: new Set([
            "keet:default:direct:plak0815:message-1",
            "keet:default:direct:plak0815:message-2",
          ]),
        },
        () => 1234,
      );

      const loaded = await loadKeetGatewayPollState(statefulAccount);
      expect(loaded.cursor).toBe("10");
      expect([...loaded.seenKeys]).toEqual([
        "keet:default:direct:plak0815:message-1",
        "keet:default:direct:plak0815:message-2",
      ]);

      const raw = await readFile(join(dir, "gateway-default.json"), "utf8");
      expect(raw).toContain('"cursor": "10"');
      expect(raw).not.toContain("hello from Plak");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("loads the persisted cursor before first poll and stores the next cursor", async () => {
    vi.useFakeTimers();
    const dir = await mkdtemp(join(tmpdir(), "keet-gateway-state-"));
    try {
      const statefulAccount = {
        ...account,
        stateDir: dir,
      };
      await saveKeetGatewayPollState(statefulAccount, {
        cursor: "9",
        seenKeys: new Set(["keet:default:direct:plak0815:message-old"]),
      });

      const abort = new AbortController();
      const setStatus = vi.fn();
      const getStatus = vi.fn(() => ({ accountId: "default" }));
      const pollBatch = vi.fn(async (params) => {
        expect(params.cursor).toBe("9");
        expect(params.seenKeys?.has("keet:default:direct:plak0815:message-old")).toBe(true);
        return {
          cursor: "10",
          processed: {
            deliveries: [],
            records: [],
            seenKeys: new Set([
              "keet:default:direct:plak0815:message-old",
              "keet:default:direct:plak0815:message-new",
            ]),
          },
        };
      });
      const gateway = createKeetGatewayAdapter({
        pollBatch,
        dispatchDelivery: async () => {},
        now: () => 1234,
      });

      const run = gateway.startAccount({
        cfg,
        account: statefulAccount,
        accountId: "default",
        abortSignal: abort.signal,
        setStatus,
        getStatus,
        channelRuntime: {},
      });
      await vi.waitFor(() => {
        expect(pollBatch).toHaveBeenCalledTimes(1);
      });

      abort.abort();
      await vi.runOnlyPendingTimersAsync();
      await run;

      const loaded = await loadKeetGatewayPollState(statefulAccount);
      expect(loaded.cursor).toBe("10");
      expect([...loaded.seenKeys]).toEqual([
        "keet:default:direct:plak0815:message-old",
        "keet:default:direct:plak0815:message-new",
      ]);
    } finally {
      vi.useRealTimers();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("polls, dedupes, dispatches deliveries, and emits healthy runtime status", async () => {
    const state: KeetGatewayPollState = { seenKeys: new Set() };
    const setStatus = vi.fn();
    const dispatchDelivery = vi.fn(async () => {});
    const pollBatch = vi.fn(async () => ({
      cursor: "2",
      processed: {
        deliveries: [
          {
            accountId: "default",
            chatType: "direct" as const,
            sessionKey: "channel:keet:default:direct:plak0815",
            routeKey: "keet:default:direct:plak0815",
            conversationId: "plak0815",
            senderId: "plak0815",
            messageId: "m-1",
            text: "hello",
          },
        ],
        records: [
          {
            key: "keet:default:direct:plak0815:m-1",
            channel: "keet" as const,
            accountId: "default",
            chatType: "direct" as const,
            conversationId: "plak0815",
            senderId: "plak0815",
            messageId: "m-1",
            textSha256: "0".repeat(64),
            textLength: 5,
            routeKey: "keet:default:direct:plak0815",
            accepted: true,
          },
        ],
        seenKeys: new Set(["keet:default:direct:plak0815:m-1"]),
      },
    }));

    const result = await pollAndDispatchKeetInbound({
      cfg,
      account,
      accountId: "default",
      state,
      setStatus,
      deps: {
        pollBatch,
        dispatchDelivery,
        now: () => 1234,
      },
    });

    expect(result).toMatchObject({
      cursor: "2",
      deliveries: 1,
    });
    expect(state.cursor).toBe("2");
    expect([...state.seenKeys]).toEqual(["keet:default:direct:plak0815:m-1"]);
    expect(dispatchDelivery).toHaveBeenCalledWith(expect.objectContaining({
      account,
      accountId: "default",
      delivery: expect.objectContaining({
        text: "hello",
      }),
    }));
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({
      running: true,
      connected: true,
      healthState: "healthy",
      lastTransportActivityAt: 1234,
      lastInboundAt: 1234,
      lastError: null,
    }));
  });

  it("dispatches inbound deliveries through the channel runtime turn runner", async () => {
    const state: KeetGatewayPollState = { seenKeys: new Set() };
    const setStatus = vi.fn();
    const sendText = vi.fn(async () => ({
      messageId: "reply-m-1",
      conversationId: "plak0815",
    }));
    const run = vi.fn(async () => ({ dispatched: true }));
    const buildContext = vi.fn((params) => ({
      Body: params.message.rawBody,
      BodyForAgent: params.message.bodyForAgent,
      CommandBody: params.message.commandBody,
      RawBody: params.message.rawBody,
      SessionKey: params.route.dispatchSessionKey,
      To: params.reply.to,
    }));
    const channelRuntime = {
      routing: {
        resolveAgentRoute: vi.fn(() => ({
          agentId: "main",
          sessionKey: "agent:main:channel:keet:default:direct:plak0815",
        })),
      },
      session: {
        resolveStorePath: vi.fn(() => "sessions"),
        recordInboundSession: vi.fn(),
      },
      reply: {
        dispatchReplyWithBufferedBlockDispatcher: vi.fn(),
      },
      inbound: {
        buildContext,
        run,
      },
    };
    const pollBatch = vi.fn(async () => ({
      cursor: "1",
      processed: {
        deliveries: [
          {
            accountId: "default",
            chatType: "direct" as const,
            sessionKey: "channel:keet:default:direct:plak0815",
            routeKey: "keet:default:direct:plak0815",
            conversationId: "plak0815",
            senderId: "plak0815",
            messageId: "m-1",
            text: "hello via runtime",
          },
        ],
        records: [],
        seenKeys: new Set(["keet:default:direct:plak0815:m-1"]),
      },
    }));

    await pollAndDispatchKeetInbound({
      cfg,
      account,
      accountId: "default",
      state,
      setStatus,
      channelRuntime,
      deps: {
        pollBatch,
        sendText,
        now: () => 1234,
      },
    });

    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      channel: "keet",
      accountId: "default",
      raw: expect.objectContaining({
        messageId: "m-1",
        text: "hello via runtime",
      }),
      adapter: expect.objectContaining({
        ingest: expect.any(Function),
        resolveTurn: expect.any(Function),
      }),
    }));
    const runArg = run.mock.calls[0]?.[0];
    const ingested = runArg.adapter.ingest(runArg.raw);
    expect(ingested).toMatchObject({
      id: "m-1",
      rawText: "hello via runtime",
      textForAgent: "hello via runtime",
    });
    const resolved = await runArg.adapter.resolveTurn(ingested, { kind: "message" }, {});
    await resolved.delivery.deliver({ text: "reply body" });
    expect(buildContext).toHaveBeenCalled();
    expect(resolved).toMatchObject({
      cfg,
      channel: "keet",
      accountId: "default",
      agentId: "main",
      routeSessionKey: "agent:main:channel:keet:default:direct:plak0815",
      storePath: "sessions",
    });
    expect(sendText).toHaveBeenCalledWith({
      bridgeCommand: "/usr/local/bin/keet-bridge",
      to: "plak0815",
      text: "reply body",
      replyToId: "m-1",
      signal: undefined,
    });
  });

  it("keeps the account running until abort and marks stop in runtime status", async () => {
    vi.useFakeTimers();
    try {
      const abort = new AbortController();
      const setStatus = vi.fn();
      const getStatus = vi.fn(() => ({ accountId: "default" }));
      const pollBatch = vi.fn(async () => ({
        cursor: "1",
        processed: {
          deliveries: [],
          records: [],
          seenKeys: new Set<string>(),
        },
      }));
      const gateway = createKeetGatewayAdapter({
        pollBatch,
        dispatchDelivery: async () => {},
      });

      const run = gateway.startAccount({
        cfg,
        account,
        accountId: "default",
        abortSignal: abort.signal,
        setStatus,
        getStatus,
        channelRuntime: {},
      });
      await vi.waitFor(() => {
        expect(pollBatch).toHaveBeenCalledTimes(1);
      });

      expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({
        accountId: "default",
        running: true,
        connected: true,
        mode: "bridge-poll",
      }));

      abort.abort();
      await vi.runOnlyPendingTimersAsync();
      await run;

      expect(setStatus).toHaveBeenLastCalledWith(expect.objectContaining({
        accountId: "default",
        running: false,
        connected: false,
        lastStopAt: expect.any(Number),
      }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps polling when an inbound dispatch is still processing", async () => {
    vi.useFakeTimers();
    try {
      const abort = new AbortController();
      const setStatus = vi.fn();
      const getStatus = vi.fn(() => ({ accountId: "default" }));
      let pollCount = 0;
      const pollBatch = vi.fn(async () => {
        pollCount += 1;
        return {
          cursor: String(pollCount),
          processed: {
            deliveries: pollCount === 1
              ? [
                {
                  accountId: "default",
                  chatType: "direct" as const,
                  sessionKey: "channel:keet:default:direct:plak0815",
                  routeKey: "keet:default:direct:plak0815",
                  conversationId: "plak0815",
                  senderId: "plak0815",
                  messageId: "m-1",
                  text: "slow turn",
                },
              ]
              : [],
            records: [],
            seenKeys: new Set<string>(),
          },
        };
      });
      const dispatchDelivery = vi.fn(() => new Promise<void>(() => {}));
      const gateway = createKeetGatewayAdapter({
        pollBatch,
        dispatchDelivery,
      });

      const run = gateway.startAccount({
        cfg,
        account,
        accountId: "default",
        abortSignal: abort.signal,
        setStatus,
        getStatus,
        channelRuntime: {},
      });
      await vi.waitFor(() => {
        expect(pollBatch).toHaveBeenCalledTimes(1);
      });
      expect(dispatchDelivery).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30_000);
      await vi.waitFor(() => {
        expect(pollBatch).toHaveBeenCalledTimes(2);
      });

      abort.abort();
      await vi.runOnlyPendingTimersAsync();
      await run;
    } finally {
      vi.useRealTimers();
    }
  });
});
