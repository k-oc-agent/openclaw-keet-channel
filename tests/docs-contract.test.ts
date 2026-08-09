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
});
