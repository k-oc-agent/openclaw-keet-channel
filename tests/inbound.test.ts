import { describe, expect, it } from "vitest";
import {
  buildInboundStateRecord,
  dedupeKeyForInbound,
  processKeetInboundEvents,
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

  it("turns poll events into transient deliveries and persistent redacted state", () => {
    const batch = processKeetInboundEvents(
      cfg,
      [
        {
          accountId: "lab",
          chatType: "direct",
          conversationId: "peer-plak",
          senderId: "peer-plak",
          messageId: "m-5",
          text: "deliver this once",
          timestampMs: 5,
        },
        {
          accountId: "lab",
          chatType: "direct",
          conversationId: "peer-plak",
          senderId: "peer-plak",
          messageId: "m-5",
          text: "deliver this once",
          timestampMs: 5,
        },
        {
          accountId: "lab",
          chatType: "direct",
          conversationId: "peer-evil",
          senderId: "peer-evil",
          messageId: "m-6",
          text: "do not deliver",
          timestampMs: 6,
        },
      ],
      new Set(),
    );

    expect(batch.deliveries).toHaveLength(1);
    expect(batch.deliveries[0]).toMatchObject({
      accountId: "lab",
      sessionKey: "channel:keet:lab:direct:peer-plak",
      text: "deliver this once",
    });
    expect(batch.records).toHaveLength(2);
    expect(batch.records.map((record) => record.accepted)).toEqual([true, false]);
    expect(batch.records[1]).toMatchObject({
      reason: "sender-not-allowlisted",
      accepted: false,
    });
    expect([...batch.seenKeys].sort()).toEqual([
      "keet:lab:direct:peer-evil:m-6",
      "keet:lab:direct:peer-plak:m-5",
    ]);
    expect(JSON.stringify(batch.records)).not.toContain("deliver this once");
    expect(JSON.stringify(batch.records)).not.toContain("do not deliver");
  });
});
