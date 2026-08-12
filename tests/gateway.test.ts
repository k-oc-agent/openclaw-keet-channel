import { describe, expect, it, vi } from "vitest";
import {
  createKeetGatewayAdapter,
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
