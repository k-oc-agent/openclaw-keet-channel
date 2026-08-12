import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("public publish readiness contract", () => {
  it("documents the Public/ClawHub publish gate and OC production boundary", async () => {
    const readiness = await readFile("docs/publish-readiness.md", "utf8");

    expect(readiness).toContain("Public/ClawHub publish is a Plak approval gate");
    expect(readiness).toContain("Do not run `clawhub package publish` without explicit Plak approval");
    expect(readiness).toContain("Do not run `npm publish` without explicit Plak approval");
    expect(readiness).toContain("No OC production install, reinstall, config mutation, or gateway restart");
    expect(readiness).toContain("npm exec clawhub@latest -- package validate .");
    expect(readiness).toContain("npm exec clawhub@latest -- package publish . --dry-run");
    expect(readiness).toContain("--source-repo");
    expect(readiness).toContain("--source-commit");
    expect(readiness).toContain("k-dev");
    expect(readiness).toContain("k-stage");
  });

  it("keeps publish readiness docs in the package allowlist", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));

    expect(packageJson.files).toContain("docs/publish-readiness.md");
  });
});
