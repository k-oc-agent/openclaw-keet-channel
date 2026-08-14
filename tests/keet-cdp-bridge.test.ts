import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const bridgeModuleUrl = pathToFileURL(`${process.cwd()}/scripts/keet-cdp-bridge.mjs`).href;

describe("Keet CDP bridge candidate", () => {
  it("derives poll targets from the bridge config when the plugin passes no chat", async () => {
    const bridge = await import(bridgeModuleUrl);
    const config = bridge.normalizeBridgeConfig({
      sender_aliases: { Plak: "plak0815", "@plak0815": "plak0815" },
      direct_peers: [
        {
          chat_name: "Plak",
          peer_id: "plak0815",
          enabled: true,
        },
      ],
      group_topics: [
        {
          chat_name: "K OC Keet Canary 2026-08-11",
          chat_id: "K OC Keet Canary 2026-08-11",
          allowed_senders: ["plak0815"],
          enabled: true,
        },
      ],
    });

    expect(bridge.enabledTargets(config)).toEqual([
      {
        chat: "Plak",
        chatType: "direct",
        conversationId: "plak0815",
      },
      {
        chat: "K OC Keet Canary 2026-08-11",
        chatType: "group",
        conversationId: "K OC Keet Canary 2026-08-11",
        allowFrom: ["plak0815"],
      },
    ]);
  });

  it("resolves bare send targets to the configured Keet sidebar chat name", async () => {
    const bridge = await import(bridgeModuleUrl);
    const config = bridge.normalizeBridgeConfig({
      direct_peers: [
        {
          chat_name: "Plak",
          peer_id: "plak0815",
          enabled: true,
        },
      ],
      group_topics: [],
    });

    expect(bridge.resolveChatTarget(config, "plak0815")).toEqual({
      chat: "Plak",
      chatType: "direct",
      conversationId: "plak0815",
    });
  });

  it("returns latest visible events regardless of an old DOM-window cursor", async () => {
    const bridge = await import(bridgeModuleUrl);

    expect(
      bridge.buildPollPayload(
        [
          {
            id: "m-new",
            chatType: "group",
            chat: "K OC Keet Canary 2026-08-11",
            sender: "plak0815",
            text: "Test 20:24",
            timestampMs: 0,
          },
        ],
        { cursor: "99", limit: 10 },
      ),
    ).toMatchObject({
      ok: true,
      poll: {
        cursor: "1",
        events: [
          {
            id: "m-new",
            chatType: "group",
            chat: "K OC Keet Canary 2026-08-11",
            sender: "plak0815",
            text: "Test 20:24",
          },
        ],
      },
    });
  });

  it("filters OpenClaw echo rows before they become inbound events", async () => {
    const bridge = await import(bridgeModuleUrl);
    const target = {
      chatType: "group",
      conversationId: "K OC Keet Canary 2026-08-11",
    };

    const echo = bridge.eventFromRow(
      {
        id: "m-echo",
        direction: "incoming",
        sender: "Plak",
        text: "K OpenClaw\n**Model: gpt-5.3-codex** Canary proof",
      },
      { target, aliases: { Plak: "plak0815" } },
    );
    const real = bridge.eventFromRow(
      {
        id: "m-real",
        direction: "incoming",
        sender: "Plak",
        text: "Angekommen",
      },
      { target, aliases: { Plak: "plak0815" } },
    );

    expect(echo).toBeNull();
    expect(real).toMatchObject({
      id: "m-real",
      chatType: "group",
      chat: "K OC Keet Canary 2026-08-11",
      sender: "plak0815",
      text: "Angekommen",
    });
  });

  it("extracts the real body from native Keet replies instead of the quoted K message", async () => {
    const bridge = await import(bridgeModuleUrl);

    expect(bridge.extractMessageBodyText([
      {
        text: "K OpenClaw\nprod 0.1.10 dm reply smoke 194722",
        isReplyQuote: true,
      },
      {
        text: "Angekommen.\nBestätigung für diese Nachricht bitte.",
        isReplyQuote: false,
      },
    ])).toBe("Angekommen.\nBestätigung für diese Nachricht bitte.");
  });

  it("recognizes Keet native Reply entries exposed only through the message menu", async () => {
    const bridge = await import(bridgeModuleUrl);

    expect(bridge.isReplyMenuItemLabel("Reply")).toBe(true);
    expect(bridge.isReplyMenuItemLabel(" Reply ")).toBe(true);
    expect(bridge.isReplyMenuItemLabel("Forward")).toBe(false);
    expect(bridge.isReplyMenuItemLabel("Delete Message")).toBe(false);
  });

  it("fails closed instead of sending a plain message when reply target selection fails", async () => {
    const bridge = await import(bridgeModuleUrl);

    expect(() => bridge.assertReplyTargetSelected("message-parent", false))
      .toThrow("could not select native reply target message-parent");
    expect(() => bridge.assertReplyTargetSelected("message-parent", true)).not.toThrow();
    expect(() => bridge.assertReplyTargetSelected(undefined, false)).not.toThrow();
  });

  it("applies the configured group sender allowlist before emitting inbound events", async () => {
    const bridge = await import(bridgeModuleUrl);
    const target = {
      chatType: "group",
      conversationId: "K OC Keet Canary 2026-08-11",
      allowFrom: ["plak0815"],
    };

    const blocked = bridge.eventFromRow(
      {
        id: "m-blocked",
        direction: "incoming",
        sender: "Mallory",
        text: "not allowed",
      },
      { target, aliases: { Plak: "plak0815" } },
    );
    const allowed = bridge.eventFromRow(
      {
        id: "m-allowed",
        direction: "incoming",
        sender: "Plak",
        text: "allowed",
      },
      { target, aliases: { Plak: "plak0815" } },
    );

    expect(blocked).toBeNull();
    expect(allowed).toMatchObject({
      id: "m-allowed",
      sender: "plak0815",
      text: "allowed",
    });
  });

  it("derives the active sidebar room name from Keet selected room styling", async () => {
    const bridge = await import(bridgeModuleUrl);

    expect(bridge.activeRoomNameFromRoomItems([
      {
        className: "border-transparent hover:border-grey600",
        lines: ["Plak", "1h", "preview"],
      },
      {
        className: "hover:border-grey600 bg-grey600 border-grey600",
        lines: ["K OC Keet Canary 2026-08-11", "12m", "preview"],
      },
    ])).toBe("K OC Keet Canary 2026-08-11");
    expect(bridge.activeRoomNameFromRoomItems([
      {
        className: "border-transparent hover:border-grey600",
        lines: ["Plak", "1h", "preview"],
      },
    ])).toBeUndefined();
  });

  it("fails closed when the active room differs from the requested send target", async () => {
    const bridge = await import(bridgeModuleUrl);

    expect(() => bridge.assertExpectedActiveRoomName("K OC Keet Canary 2026-08-11", "Plak", "before composer"))
      .toThrow("Keet CDP active room mismatch before composer: expected Plak, active K OC Keet Canary 2026-08-11");
  });

  it("fails closed when the requested send target has no selected sidebar room", async () => {
    const bridge = await import(bridgeModuleUrl);

    expect(() => bridge.assertExpectedActiveRoomName(undefined, "Plak", "after send"))
      .toThrow("Keet CDP active room mismatch after send: expected Plak, active <none>");
  });

  it("declares the runtime command verbs needed by the bridge contract", async () => {
    const bridge = await import(bridgeModuleUrl);

    expect(bridge.supportedActions).toEqual(["send", "poll"]);
  });
});
