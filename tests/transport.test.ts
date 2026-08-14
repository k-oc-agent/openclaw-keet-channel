import { describe, expect, it, vi } from "vitest";
import {
  buildBridgeCliArgs,
  normalizeKeetSendTarget,
  pollInboundWithBridgeCli,
  sendTextWithBridgeCli,
} from "../src/transport.js";

describe("Keet bridge-cli transport", () => {
  it("builds argv arrays instead of shell command strings", () => {
    expect(
      buildBridgeCliArgs({
        bridgeCommand: "/usr/local/bin/keet-bridge",
        action: "send",
        to: "Plak; rm -rf /",
        text: "hello $(whoami)",
      }),
    ).toEqual([
      "/usr/local/bin/keet-bridge",
      "send",
      "--chat",
      "Plak; rm -rf /",
      "--text",
      "hello $(whoami)",
    ]);
  });

  it("passes native reply targets as separate bridge argv entries", () => {
    expect(
      buildBridgeCliArgs({
        bridgeCommand: "/usr/local/bin/keet-bridge",
        action: "send",
        to: "Plak",
        text: "reply text",
        replyToId: "message-parent-1",
      }),
    ).toEqual([
      "/usr/local/bin/keet-bridge",
      "send",
      "--chat",
      "Plak",
      "--text",
      "reply text",
      "--reply-to",
      "message-parent-1",
    ]);
  });

  it("builds poll argv with bounded limits and optional cursor", () => {
    expect(
      buildBridgeCliArgs({
        bridgeCommand: "/usr/local/bin/keet-bridge",
        action: "poll",
        accountId: "prod",
        limit: 25,
        cursor: "cursor-1",
      }),
    ).toEqual([
      "/usr/local/bin/keet-bridge",
      "poll",
      "--account",
      "prod",
      "--limit",
      "25",
      "--cursor",
      "cursor-1",
    ]);
  });

  it("requires explicit non-empty target and text", () => {
    expect(() =>
      buildBridgeCliArgs({
        bridgeCommand: "/usr/local/bin/keet-bridge",
        action: "send",
        to: "",
        text: "hello",
      }),
    ).toThrow("Keet target is required");
    expect(() =>
      buildBridgeCliArgs({
        bridgeCommand: "/usr/local/bin/keet-bridge",
        action: "send",
        to: "Plak",
        text: "",
      }),
    ).toThrow("Keet text is required");
  });

  it("normalizes Keet-scoped targets and rejects foreign channel locators", () => {
    expect(normalizeKeetSendTarget("Plak")).toBe("Plak");
    expect(normalizeKeetSendTarget("keet:plak0815")).toBe("plak0815");
    expect(normalizeKeetSendTarget("keet:group:K OC Keet Canary")).toBe("K OC Keet Canary");
    expect(normalizeKeetSendTarget("channel:keet:default:direct:plak0815")).toBe("plak0815");
    expect(normalizeKeetSendTarget("channel:keet:default:group:K OC: Canary")).toBe("K OC: Canary");
    expect(() => normalizeKeetSendTarget("channel:1536020088753488003")).toThrow(
      "Keet target must be a Keet conversation target",
    );
  });

  it("parses bridge JSON receipts without executing through a shell", async () => {
    const run = vi.fn(async () => ({
      stdout: JSON.stringify({
        ok: true,
        send: {
          latestOutgoing: {
            id: "m1",
            chat: "Plak",
          },
        },
      }),
    }));

    await expect(
      sendTextWithBridgeCli({
        bridgeCommand: "/usr/local/bin/keet-bridge",
        to: "Plak",
        text: "pong",
        replyToId: "m-parent",
        run,
      }),
    ).resolves.toEqual({
      messageId: "m1",
      conversationId: "Plak",
      raw: {
        id: "m1",
        chat: "Plak",
      },
    });

    expect(run).toHaveBeenCalledWith([
      "/usr/local/bin/keet-bridge",
      "send",
      "--chat",
      "Plak",
      "--text",
      "pong",
      "--reply-to",
      "m-parent",
    ]);
  });

  it("parses inbound poll events through the documented bridge contract", async () => {
    const run = vi.fn(async () => ({
      stdout: JSON.stringify({
        ok: true,
        poll: {
          cursor: "next-cursor",
          events: [
            {
              id: "m-in-1",
              chatType: "direct",
              chat: "plak0815",
              sender: "plak0815",
              text: "ping from keet",
              timestampMs: 1786513700000,
            },
          ],
        },
      }),
    }));

    await expect(
      pollInboundWithBridgeCli({
        bridgeCommand: "/usr/local/bin/keet-bridge",
        accountId: "default",
        limit: 25,
        cursor: "cursor-1",
        run,
      }),
    ).resolves.toEqual({
      cursor: "next-cursor",
      events: [
        {
          accountId: "default",
          chatType: "direct",
          conversationId: "plak0815",
          senderId: "plak0815",
          messageId: "m-in-1",
          text: "ping from keet",
          timestampMs: 1786513700000,
          mentioned: undefined,
        },
      ],
      raw: expect.any(Object),
    });

    expect(run).toHaveBeenCalledWith([
      "/usr/local/bin/keet-bridge",
      "poll",
      "--account",
      "default",
      "--limit",
      "25",
      "--cursor",
      "cursor-1",
    ]);
  });
});
