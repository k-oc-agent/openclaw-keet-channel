import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("package metadata", () => {
  it("uses OpenClaw install metadata accepted by the plugin installer", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));

    expect(packageJson.openclaw.install.minHostVersion).toMatch(
      /^>=[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
    );
    expect(packageJson.openclaw.install.npmSpec).toBe(`${packageJson.name}@${packageJson.version}`);
    expect(packageJson.openclaw.compat.pluginApi).toMatch(/^>=[0-9]+\.[0-9]+\.[0-9]+/);
    expect(packageJson.openclaw.compat.minGatewayVersion).toMatch(/^>=[0-9]+\.[0-9]+\.[0-9]+/);
    expect(packageJson.private).toBeUndefined();
    expect(packageJson.license).toBe("MIT");
    expect(packageJson.exports).toMatchObject({
      ".": "./dist/src/index.js",
      "./gateway": "./dist/src/gateway.js",
      "./inbound": "./dist/src/inbound.js",
      "./poller": "./dist/src/poller.js",
      "./transport": "./dist/src/transport.js",
    });
    expect(packageJson.files).toEqual(expect.arrayContaining([
      "CHANGELOG.md",
      "LICENSE",
      "docs/bridge-cli-contract.md",
      "docs/release.md",
    ]));
    expect(packageJson.files).not.toContain("docs");
    expect(packageJson.files).not.toContain("docs/proofs");
  });
});
