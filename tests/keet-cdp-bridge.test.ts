import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const bridgeModuleUrl = pathToFileURL(`${process.cwd()}/scripts/keet-cdp-bridge.mjs`).href;

describe("Keet CDP bridge candidate", () => {
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

  it("declares the runtime command verbs needed by the bridge contract", async () => {
    const bridge = await import(bridgeModuleUrl);

    expect(bridge.supportedActions).toEqual(["send", "poll"]);
  });
});
