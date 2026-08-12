import { describe, expect, it, vi } from "vitest";
import { pollKeetInboundBatch } from "../src/poller.js";

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

describe("Keet inbound poller", () => {
  it("polls the configured bridge and returns deliverable allowlisted DMs", async () => {
    const run = vi.fn(async () => ({
      stdout: JSON.stringify({
        ok: true,
        poll: {
          cursor: "2",
          events: [
            {
              id: "m-1",
              chatType: "direct",
              chat: "plak0815",
              sender: "plak0815",
              text: "hello K",
              timestampMs: 1786513700000,
            },
            {
              id: "m-2",
              chatType: "direct",
              chat: "mallory",
              sender: "mallory",
              text: "nope",
              timestampMs: 1786513700001,
            },
          ],
        },
      }),
    }));

    const batch = await pollKeetInboundBatch({
      cfg,
      accountId: "default",
      cursor: "0",
      seenKeys: new Set(),
      limit: 10,
      run,
    });

    expect(batch.cursor).toBe("2");
    expect(batch.processed.deliveries).toHaveLength(1);
    expect(batch.processed.deliveries[0]).toMatchObject({
      accountId: "default",
      sessionKey: "channel:keet:default:direct:plak0815",
      text: "hello K",
    });
    expect(batch.processed.records).toHaveLength(2);
    expect(JSON.stringify(batch.processed.records)).not.toContain("hello K");
    expect(JSON.stringify(batch.processed.records)).not.toContain("nope");
    expect(run).toHaveBeenCalledWith([
      "/usr/local/bin/keet-bridge",
      "poll",
      "--account",
      "default",
      "--limit",
      "10",
      "--cursor",
      "0",
    ]);
  });
});
