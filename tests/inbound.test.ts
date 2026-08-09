import { describe, expect, it } from "vitest";
import {
  buildInboundStateRecord,
  dedupeKeyForInbound,
  routeKeetInbound,
} from "../src/inbound.js";

const cfg = {
  channels: {
    keet: {
      defaultAccount: "lab",
      accounts: {
        lab: {
          enabled: true,
          bridgeCommand: "/usr/local/bin/keet-bridge",
          dmPolicy: "allowlist",
          allowFrom: ["peer-plak"],
          groups: {
            "group-stage": {
              enabled: true,
              allowFrom: ["peer-plak"],
            },
          },
        },
      },
    },
  },
};

describe("Keet inbound routing", () => {
  it("routes allowlisted direct messages into stable OpenClaw session keys", () => {
    expect(
      routeKeetInbound(cfg, {
        accountId: "lab",
        chatType: "direct",
        conversationId: "peer-plak",
        senderId: "peer-plak",
        messageId: "m-1",
        text: "hello",
        timestampMs: 1,
      }),
    ).toMatchObject({
      allowed: true,
      routeKey: "keet:lab:direct:peer-plak",
      sessionKey: "channel:keet:lab:direct:peer-plak",
    });
  });

  it("rejects unconfigured production-style groups by default", () => {
    expect(
      routeKeetInbound(cfg, {
        accountId: "lab",
        chatType: "group",
        conversationId: "prod-group",
        senderId: "peer-plak",
        messageId: "m-2",
        text: "hello",
        timestampMs: 2,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "group-not-configured",
    });
  });

  it("rejects direct senders outside the allowlist", () => {
    expect(
      routeKeetInbound(cfg, {
        accountId: "lab",
        chatType: "direct",
        conversationId: "peer-unknown",
        senderId: "peer-unknown",
        messageId: "m-3",
        text: "hello",
        timestampMs: 3,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "sender-not-allowlisted",
    });
  });

  it("builds dedupe/state records without persisting message text", () => {
    const event = {
      accountId: "lab",
      chatType: "direct" as const,
      conversationId: "peer-plak",
      senderId: "peer-plak",
      messageId: "m-4",
      text: "secret message text",
      timestampMs: 4,
    };
    const route = routeKeetInbound(cfg, event);
    const record = buildInboundStateRecord(event, route);

    expect(dedupeKeyForInbound(event)).toBe("keet:lab:direct:peer-plak:m-4");
    expect(record).toMatchObject({
      key: "keet:lab:direct:peer-plak:m-4",
      accountId: "lab",
      channel: "keet",
      chatType: "direct",
      conversationId: "peer-plak",
      senderId: "peer-plak",
      messageId: "m-4",
      textLength: "secret message text".length,
      routeKey: "keet:lab:direct:peer-plak",
    });
    expect(JSON.stringify(record)).not.toContain("secret message text");
    expect(record.textSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
