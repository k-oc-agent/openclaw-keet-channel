import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("fake Keet bridge", () => {
  it("records deterministic redacted send evidence without touching real Keet", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "keet-fake-bridge-"));
    const logPath = join(tempDir, "bridge.ndjson");
    const { stdout } = await execFileAsync(
      "node",
      ["scripts/fake-keet-bridge.mjs", "send", "--chat", "stage-fake-chat", "--text", "stage smoke text"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          KEET_FAKE_BRIDGE_LOG: logPath,
        },
      },
    );

    const receipt = JSON.parse(stdout);
    expect(receipt).toMatchObject({
      ok: true,
      fake: true,
      send: {
        latestOutgoing: {
          chat: "stage-fake-chat",
        },
      },
    });
    expect(receipt.send.latestOutgoing.id).toMatch(/^fake-keet-[a-f0-9]{24}$/);

    const [line] = (await readFile(logPath, "utf8")).trim().split("\n");
    const evidence = JSON.parse(line);
    expect(evidence).toMatchObject({
      kind: "fake-keet-bridge-send",
      action: "send",
      chat: "stage-fake-chat",
      argv: ["send", "--chat", "stage-fake-chat", "--text", "<redacted>"],
      textLength: "stage smoke text".length,
      realKeetTouched: false,
    });
    expect(evidence.textSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.messageId).toEqual(receipt.send.latestOutgoing.id);
  });

  it("records reply targets without persisting raw message text", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "keet-fake-bridge-"));
    const logPath = join(tempDir, "bridge.ndjson");
    const { stdout } = await execFileAsync(
      "node",
      [
        "scripts/fake-keet-bridge.mjs",
        "send",
        "--chat",
        "stage-fake-chat",
        "--text",
        "reply body",
        "--reply-to",
        "message-parent-1",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          KEET_FAKE_BRIDGE_LOG: logPath,
        },
      },
    );

    const receipt = JSON.parse(stdout);
    expect(receipt.send.latestOutgoing).toMatchObject({
      chat: "stage-fake-chat",
      replyToId: "message-parent-1",
    });

    const [line] = (await readFile(logPath, "utf8")).trim().split("\n");
    const evidence = JSON.parse(line);
    expect(evidence).toMatchObject({
      action: "send",
      replyToId: "message-parent-1",
      argv: [
        "send",
        "--chat",
        "stage-fake-chat",
        "--text",
        "<redacted>",
        "--reply-to",
        "message-parent-1",
      ],
    });
    expect(JSON.stringify(evidence)).not.toContain("reply body");
  });

  it("polls deterministic fake inbound events without persisting raw text", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "keet-fake-bridge-"));
    const logPath = join(tempDir, "bridge.ndjson");
    const eventPath = join(tempDir, "events.ndjson");
    const event = {
      id: "fake-in-1",
      chatType: "direct",
      chat: "plak0815",
      sender: "plak0815",
      text: "inbound hello",
      timestampMs: 1786513700000,
    };
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(eventPath, `${JSON.stringify(event)}\n`, "utf8"),
    );

    const { stdout } = await execFileAsync(
      "node",
      [
        "scripts/fake-keet-bridge.mjs",
        "poll",
        "--account",
        "default",
        "--limit",
        "10",
        "--cursor",
        "0",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          KEET_FAKE_BRIDGE_LOG: logPath,
          KEET_FAKE_BRIDGE_EVENTS: eventPath,
        },
      },
    );

    const payload = JSON.parse(stdout);
    expect(payload).toMatchObject({
      ok: true,
      fake: true,
      poll: {
        cursor: "1",
        events: [event],
      },
    });

    const [line] = (await readFile(logPath, "utf8")).trim().split("\n");
    const evidence = JSON.parse(line);
    expect(evidence).toMatchObject({
      kind: "fake-keet-bridge-poll",
      action: "poll",
      account: "default",
      limit: 10,
      cursor: "0",
      eventCount: 1,
      realKeetTouched: false,
    });
    expect(JSON.stringify(evidence)).not.toContain("inbound hello");
  });

  it("generates redacted invite evidence for Canary join handoff", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "keet-fake-bridge-"));
    const logPath = join(tempDir, "bridge.ndjson");
    const { stdout } = await execFileAsync(
      "node",
      ["scripts/fake-keet-bridge.mjs", "invite", "--chat", "K OC Keet Canary", "--ttl-days", "14"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          KEET_FAKE_BRIDGE_LOG: logPath,
        },
      },
    );

    const payload = JSON.parse(stdout);
    expect(payload).toMatchObject({
      ok: true,
      fake: true,
      invite: {
        chat: "K OC Keet Canary",
        ttlDays: 14,
      },
    });
    expect(payload.invite.link).toMatch(/^keet:\/\/invite\/fake-/);
    expect(payload.invite.qrPayload).toEqual(payload.invite.link);

    const [line] = (await readFile(logPath, "utf8")).trim().split("\n");
    const evidence = JSON.parse(line);
    expect(evidence).toMatchObject({
      kind: "fake-keet-bridge-invite",
      action: "invite",
      chat: "K OC Keet Canary",
      ttlDays: 14,
      realKeetTouched: false,
    });
    expect(evidence.inviteSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(evidence)).not.toContain(payload.invite.link);
    expect(JSON.stringify(evidence)).not.toContain(payload.invite.qrPayload);
  });

  it("reads back group membership for Canary join verification", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "keet-fake-bridge-"));
    const logPath = join(tempDir, "bridge.ndjson");
    const { stdout } = await execFileAsync(
      "node",
      [
        "scripts/fake-keet-bridge.mjs",
        "chat-info",
        "--chat",
        "K OC Keet Canary",
        "--member",
        "k-oc",
        "--member",
        "plak0815",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          KEET_FAKE_BRIDGE_LOG: logPath,
        },
      },
    );

    const payload = JSON.parse(stdout);
    expect(payload).toMatchObject({
      ok: true,
      fake: true,
      chatInfo: {
        chat: "K OC Keet Canary",
        memberCount: 2,
        members: ["k-oc", "plak0815"],
      },
    });

    const [line] = (await readFile(logPath, "utf8")).trim().split("\n");
    const evidence = JSON.parse(line);
    expect(evidence).toMatchObject({
      kind: "fake-keet-bridge-chat-info",
      action: "chat-info",
      chat: "K OC Keet Canary",
      memberCount: 2,
      realKeetTouched: false,
    });
    expect(evidence.memberIds).toEqual(["k-oc", "plak0815"]);
  });
});
