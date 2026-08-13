import { describe, expect, it } from "vitest";
import { classifyJoinLog, redactJoinLog } from "../src/join-diagnostics.js";

describe("Keet join diagnostics", () => {
  it("classifies the Autobase closing join failure", () => {
    const result = classifyJoinLog(`
      startPairingRoom invite join started
      _startPairing failed
      UNEXPECTED_ERROR: Autobase is closing
    `);

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("autobase-closing");
    expect(result.signatures).toEqual([
      "startPairingRoom",
      "_startPairing",
      "UNEXPECTED_ERROR: Autobase is closing",
    ]);
    expect(result.safeSummary).toContain("Keet pairing failed because Autobase is closing");
    expect(result.nextGate).toContain("Do not clean or reset the Keet profile without explicit approval");
  });

  it("distinguishes an already joined room from a failed join", () => {
    const result = classifyJoinLog(`
      chatInfo K OC Keet Canary 2026-08-11
      memberCount: 2
      You joined the group
    `);

    expect(result.status).toBe("already-joined");
    expect(result.reason).toBe("membership-readback");
    expect(result.signatures).toEqual(["memberCount >= 2", "You joined the group"]);
  });

  it("redacts invite and QR payload material from evidence", () => {
    const redacted = redactJoinLog(`
      invite keet://chat/super-secret-token
      qrPayload: keet://invite/another-secret-token
      recoveryPhrase: never store these words
      normal line
    `);

    expect(redacted).toContain("invite keet://<redacted>");
    expect(redacted).toContain("qrPayload: <redacted>");
    expect(redacted).toContain("recoveryPhrase: <redacted>");
    expect(redacted).toContain("normal line");
    expect(redacted).not.toContain("super-secret-token");
    expect(redacted).not.toContain("another-secret-token");
    expect(redacted).not.toContain("never store these words");
  });
});
