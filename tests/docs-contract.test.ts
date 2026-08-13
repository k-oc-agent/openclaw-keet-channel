import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("documentation contract", () => {
  it("records the native transport no-go and bridge MVP decision", async () => {
    const adr = await readFile("docs/adr/0002-transport-strategy.md", "utf8");
    const spike = await readFile("docs/spikes/native-transport-spike-2026-08-09.md", "utf8");

    expect(adr).toContain("Keep the bridge-CLI transport as the supported MVP");
    expect(adr).toMatch(
      /Do not implement direct Pear\/Holepunch transport against production Keet\s+state now/,
    );
    expect(adr).toContain("Stop Criteria for Direct Transport");
    expect(spike).toContain("No-go for direct native Pear/Holepunch production transport");
    expect(spike).toContain("Threat Model");
    expect(spike).toContain("Acceptance Mapping");
  });

  it("distinguishes profile proof from dedicated dev/stage host proof", async () => {
    const profileProof = await readFile("docs/proofs/stage-install-proof-2026-08-09.md", "utf8");
    const hostProof = await readFile("docs/proofs/dev-stage-host-install-proof-2026-08-09.md", "utf8");

    expect(profileProof).toContain("package/profile proof only");
    expect(hostProof).toMatch(/Dev and Stage are the\s+dedicated hosts `k-dev` and `k-stage`/);
    expect(hostProof).toContain("Both hosts show Keet as installed, not configured and disabled");
    expect(hostProof).toContain("Production use is still blocked by");
  });

  it("documents the public bridge contract and rollback boundary", async () => {
    const bridge = await readFile("docs/bridge-cli-contract.md", "utf8");
    const release = await readFile("docs/release.md", "utf8");
    const readme = await readFile("README.md", "utf8");

    expect(bridge).toContain("send");
    expect(bridge).toContain("poll");
    expect(bridge).toContain("invite");
    expect(bridge).toContain("chat-info");
    expect(bridge).toContain("No recovery phrases");
    expect(bridge).toContain("MUST NOT persist raw message text");
    expect(bridge).toContain("MUST NOT persist invite links or QR payloads");
    expect(bridge).toContain("MUST NOT treat `cursor` as an index into a virtualized DOM window");
    expect(bridge).toContain("MUST filter visible `K OpenClaw` echo rows");
    expect(release).toContain("Rollback");
    expect(release).toContain("disable the Keet channel in OpenClaw");
    expect(release).toContain("leave Keet identity material untouched");
    expect(readme).toContain("Inbound polling");
  });

  it("documents the Canary invite and join readback flow without storing secrets", async () => {
    const runbook = await readFile("docs/proofs/canary-invite-join-runbook.md", "utf8");

    expect(runbook).toContain("Issue: `Plak/openclaw-keet-channel#7`");
    expect(runbook).toContain("Group info -> Share invite link -> Generate new link");
    expect(runbook).toContain("keet-bridge invite");
    expect(runbook).toContain("keet-bridge chat-info");
    expect(runbook).toContain("memberCount >= 2");
    expect(runbook).toContain("Do not paste invite links");
    expect(runbook).toContain("Do not store QR payloads");
    expect(runbook).toContain("Issue: `Plak/openclaw-keet-channel#16`");
    expect(runbook).toContain("UNEXPECTED_ERROR: Autobase is closing");
    expect(runbook).toContain("Do not clean or reset the Keet profile without explicit approval");
  });

  it("documents the ClawHub dogfood proof and keeps production gated", async () => {
    const proof = await readFile("docs/proofs/clawhub-dogfood-proof-2026-08-13.md", "utf8");

    expect(proof).toContain("Plak/openclaw-keet-channel#14");
    expect(proof).toContain("clawhub:@plak/openclaw-keet-channel");
    expect(proof).toContain("@plak/openclaw-keet-channel@0.1.2");
    expect(proof).toContain("k-dev");
    expect(proof).toContain("k-stage");
    expect(proof).toContain("realKeetTouched=false");
    expect(proof).toContain("No OC production install, reinstall, config mutation, or gateway restart");
    expect(proof).toContain("Approve OC production dogfood install for Keet ClawHub package v0.1.2");
  });
});
