import { describe, expect, it, vi } from "vitest";
import { createKeetMessageAdapter } from "../src/message-adapter.js";

describe("Keet message adapter", () => {
  it("declares only durable text send support for the MVP", () => {
    const adapter = createKeetMessageAdapter({
      sendText: async () => ({
        messageId: "unused",
        conversationId: "unused",
      }),
    });

    expect(adapter.id).toBe("keet");
    expect(adapter.durableFinal.capabilities).toEqual({
      text: true,
      media: false,
      poll: false,
      replyTo: false,
      thread: false,
      messageSendingHooks: true,
    });
  });

  it("returns OpenClaw message receipts from native Keet send evidence", async () => {
    const sendText = vi.fn(async () => ({
      messageId: "keet-message-1",
      conversationId: "Plak",
      raw: { ok: true },
    }));
    const adapter = createKeetMessageAdapter({ sendText });

    const result = await adapter.send.text({
      cfg: {},
      to: "Plak",
      text: "Hallo",
      accountId: "default",
      signal: new AbortController().signal,
    });

    expect(sendText).toHaveBeenCalledWith({
      cfg: {},
      to: "Plak",
      text: "Hallo",
      accountId: "default",
      signal: expect.any(AbortSignal),
    });
    expect(result.receipt.primaryPlatformMessageId).toBe("keet-message-1");
    expect(result.receipt.parts[0]).toMatchObject({
      platformMessageId: "keet-message-1",
      kind: "text",
      raw: {
        channel: "keet",
        messageId: "keet-message-1",
        conversationId: "Plak",
      },
    });
  });
});
