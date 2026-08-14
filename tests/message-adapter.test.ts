import { describe, expect, it, vi } from "vitest";
import { keetChannelPlugin } from "../src/index.js";
import { createKeetMessageAdapter } from "../src/message-adapter.js";

const cfg = {
  session: {
    dmScope: "per-channel-peer",
  },
  channels: {
    keet: {
      defaultAccount: "default",
      accounts: {
        default: {
          bridgeCommand: "/usr/local/bin/keet-bridge",
          dmPolicy: "allowlist",
          allowFrom: ["plak0815"],
          defaultTo: "plak0815",
          groups: {
            "K OC Keet Canary 2026-08-11": {
              enabled: true,
              allowFrom: ["plak0815"],
            },
          },
        },
      },
    },
  },
};

describe("Keet message adapter", () => {
  it("declares durable text replies through Keet native reply targets", () => {
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
      replyTo: true,
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
      replyToId: "keet-message-parent",
      accountId: "default",
      signal: new AbortController().signal,
    });

    expect(sendText).toHaveBeenCalledWith({
      cfg: {},
      to: "Plak",
      text: "Hallo",
      replyToId: "keet-message-parent",
      accountId: "default",
      signal: expect.any(AbortSignal),
    });
    expect(result.receipt.primaryPlatformMessageId).toBe("keet-message-1");
    expect(result.receipt.replyToId).toBe("keet-message-parent");
    expect(result.receipt.parts[0]).toMatchObject({
      platformMessageId: "keet-message-1",
      kind: "text",
      replyToId: "keet-message-parent",
      raw: {
        channel: "keet",
        messageId: "keet-message-1",
        conversationId: "Plak",
      },
    });
  });

  it("resolves direct Keet message targets for the generic message path", async () => {
    const resolveTarget = keetChannelPlugin.messaging?.targetResolver?.resolveTarget;
    expect(resolveTarget).toBeDefined();

    expect(await resolveTarget!({
      cfg,
      accountId: "default",
      input: "plak0815",
      normalized: "plak0815",
      preferredKind: "user",
    })).toMatchObject({
      to: "plak0815",
      kind: "user",
      display: "plak0815",
      source: "normalized",
    });

    expect(await resolveTarget!({
      cfg,
      accountId: "default",
      input: "keet:direct:plak0815",
      normalized: "direct:plak0815",
      preferredKind: "user",
    })).toMatchObject({
      to: "plak0815",
      kind: "user",
    });
  });

  it("resolves runtime Keet conversation targets without treating them as foreign channels", async () => {
    const resolveTarget = keetChannelPlugin.messaging?.targetResolver?.resolveTarget;
    expect(resolveTarget).toBeDefined();

    expect(await resolveTarget!({
      cfg,
      accountId: "default",
      input: "channel:keet:default:direct:plak0815",
      normalized: "channel:keet:default:direct:plak0815",
      preferredKind: "user",
    })).toMatchObject({
      to: "plak0815",
      kind: "user",
    });
  });

  it("builds outbound sessions that match inbound Keet direct sessions", async () => {
    const route = await keetChannelPlugin.messaging?.resolveOutboundSessionRoute?.({
      cfg,
      agentId: "main",
      accountId: "default",
      target: "plak0815",
    });

    expect(route).toMatchObject({
      sessionKey: "agent:main:keet:direct:plak0815",
      recipientSessionExact: true,
      to: "plak0815",
    });
  });
});
