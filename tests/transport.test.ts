import { describe, expect, it, vi } from "vitest";
import { buildBridgeCliArgs, sendTextWithBridgeCli } from "../src/transport.js";

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
    ]);
  });
});
