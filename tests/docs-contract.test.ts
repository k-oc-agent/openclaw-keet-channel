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
    expect(bridge).toContain("plugin poll command intentionally has no `--chat` argument");
    expect(bridge).toContain("prefer sidebar room-list entries");
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

  it("requires persistent Dev/Stage Keet test identities for real smokes", async () => {
    const spec = await readFile("docs/spec/mvp.md", "utf8");
    const readme = await readFile("README.md", "utf8");
    const uat = await readFile("docs/uat/dev-stage-real-uat.md", "utf8");
    const harnessRunbook = await readFile("docs/uat/persistent-dev-stage-harness.md", "utf8");
    const harnessPlan = JSON.parse(await readFile("docs/uat/persistent-dev-stage-plan.json", "utf8"));

    expect(spec).toContain("Dedicated Keet Test Identities");
    expect(spec).toMatch(/two persistent Keet test identities per\s+environment/);
    expect(spec).toMatch(/[Rr]euse them across releases/);
    expect(spec).toContain("OpenBao");
    expect(spec).toContain("recovery_phrase");
    expect(spec).toContain("Fake bridge proofs are a preflight");
    expect(readme).toContain("Real Dev/Stage smokes use dedicated persistent Keet test identities");
    expect(readme).toContain("docs/uat/dev-stage-real-uat.md");
    expect(uat).toContain("DM UATs");
    expect(uat).toContain("Group Chat UATs");
    expect(uat).toContain("Reply UATs");
    expect(uat).toContain("Quote Reply UATs");
    expect(uat).toContain("OpenClaw Processing UATs");
    expect(uat).toContain("UAT-DEV-QUOTE-001");
    expect(uat).toContain("UAT-STAGE-QUOTE-002");
    expect(uat).toContain("UAT-DEV-PROC-002");
    expect(uat).toContain("UAT-STAGE-PROC-002");
    expect(uat).toContain("Restart And Recovery UATs");
    expect(uat).toContain("Negative And Security UATs");
    expect(uat).toContain("Do not store recovery phrases");
    expect(uat).toContain("production Keet groups remain out of scope");
    expect(uat).toContain("UAT-DEV-GROUP-001");
    expect(uat).toContain("UAT-STAGE-GROUP-001");
    expect(uat).toContain("scripts/keet-real-uat-harness.mjs validate");
    expect(readme).toContain("docs/uat/persistent-dev-stage-harness.md");
    expect(harnessRunbook).toContain("Plak/openclaw-keet-channel#19");
    expect(harnessRunbook).toContain("scripts/keet-real-uat-harness.mjs validate");
    expect(harnessRunbook).toContain("No Secret Evidence Guard");
    expect(harnessRunbook).toContain("DM A<->B");
    expect(harnessRunbook).toContain("Group A<->B");
    expect(harnessRunbook).toContain("OpenClaw processes the direct event");
    expect(harnessRunbook).toContain("Run quote reply processing");
    expect(harnessRunbook).toContain("Verify bridge-poll emits the user-authored body");
    expect(harnessRunbook).toContain("profile copy is rejected");
    expect(harnessRunbook).toContain("backup-file export is pending");
    expect(harnessPlan.environments.map((env: { name: string }) => env.name)).toEqual(["dev", "stage"]);
    for (const env of harnessPlan.environments) {
      expect(env.host).toMatch(/^k-(dev|stage)$/);
      expect(env.accounts).toHaveLength(2);
      expect(env.uats).toEqual(expect.arrayContaining([
        "dm-a-to-b",
        "dm-b-to-a",
        "group-a-to-b",
        "group-b-to-a",
        "bridge-poll-direct",
        "bridge-poll-group",
        "quote-reply-direct",
        "quote-reply-group",
        "openclaw-process-direct",
        "openclaw-process-native-reply-direct",
        "openclaw-process-group",
      ]));
    }
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
