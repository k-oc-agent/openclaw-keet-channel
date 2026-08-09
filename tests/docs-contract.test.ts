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
});
