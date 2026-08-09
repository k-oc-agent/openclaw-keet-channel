import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("package metadata", () => {
  it("uses OpenClaw install metadata accepted by the plugin installer", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));

    expect(packageJson.openclaw.install.minHostVersion).toMatch(
      /^>=[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
    );
    expect(packageJson.openclaw.compat.pluginApi).toMatch(/^>=[0-9]+\.[0-9]+\.[0-9]+/);
    expect(packageJson.openclaw.compat.minGatewayVersion).toMatch(/^>=[0-9]+\.[0-9]+\.[0-9]+/);
  });
});
