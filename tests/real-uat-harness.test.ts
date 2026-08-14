import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSecretSafeEvidence,
  buildEvidenceSkeleton,
  loadPlan,
  validateEvidence,
  validatePlan,
} from "../scripts/keet-real-uat-harness.mjs";

describe("persistent Keet real UAT harness", () => {
  it("validates the repo-owned Dev/Stage plan and renders redacted evidence skeletons", async () => {
    const plan = await loadPlan("docs/uat/persistent-dev-stage-plan.json");
    const summary = validatePlan(plan);

    expect(summary.environments).toEqual(["dev", "stage"]);
    expect(summary.uatCount).toBeGreaterThanOrEqual(8);
    expect(summary.openBaoPaths).toEqual([
      "kv/data/openclaw/keet/dev/test-a",
      "kv/data/openclaw/keet/dev/test-b",
      "kv/data/openclaw/keet/stage/test-a",
      "kv/data/openclaw/keet/stage/test-b",
    ]);

    const evidence = buildEvidenceSkeleton(plan, "dev");
    expect(evidence.environment).toBe("dev");
    expect(evidence.accounts).toHaveLength(2);
    expect(evidence.accounts[0]).toMatchObject({
      role: "a",
      openBaoPath: "kv/data/openclaw/keet/dev/test-a",
      recoveryPhraseLength: 24,
    });
    expect(JSON.stringify(evidence)).not.toContain("recovery_phrase");
    expect(JSON.stringify(evidence)).not.toContain("backup_password");
  });

  it("rejects evidence that contains recovery material or invite links", () => {
    expect(() => assertSecretSafeEvidence({ invite: "keet://invite/super-secret" })).toThrow(
      /invite/i,
    );
    expect(() =>
      assertSecretSafeEvidence({
        recovery_phrase: "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu",
      }),
    ).toThrow(/secret key/i);
    expect(() => assertSecretSafeEvidence({ backup_password: "never-write-this" })).toThrow(
      /secret key/i,
    );
  });

  it("fails closed when an environment omits receive or processing coverage", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "keet-real-uat-plan-"));
    const planPath = join(tempDir, "plan.json");
    const plan = JSON.parse(await readFile("docs/uat/persistent-dev-stage-plan.json", "utf8"));
    plan.environments[0].uats = ["dm-a-to-b", "dm-b-to-a", "group-a-to-b", "group-b-to-a"];
    await writeFile(planPath, JSON.stringify(plan));

    await expect(loadPlan(planPath).then(validatePlan)).rejects.toThrow(/missing required UAT/i);
  });

  it("rejects quote-reply evidence that only proves a plain message reached the room", async () => {
    const plan = await loadPlan("docs/uat/persistent-dev-stage-plan.json");
    const evidence = buildEvidenceSkeleton(plan, "dev");
    evidence.uats = evidence.uats.map((uat) => ({
      ...uat,
      status: "passed",
      messageIds: [`${uat.id}-message`],
      receiptIds: [`${uat.id}-receipt`],
    }));

    expect(() => validateEvidence(plan, evidence)).toThrow(/native quote reply structure/i);
  });

  it("accepts quote-reply evidence only with native quote structure and target-room proof", async () => {
    const plan = await loadPlan("docs/uat/persistent-dev-stage-plan.json");
    const evidence = buildEvidenceSkeleton(plan, "dev");
    const proof = {
      verified: true,
      targetRoomVerified: true,
      absentFromWrongRoom: true,
      notPlainMessageOnly: true,
      quotedParentMessageId: "message-parent",
      replyMessageId: "message-reply",
      bodyTextSha256: "a".repeat(64),
      quoteTextSha256: "b".repeat(64),
    };
    evidence.uats = evidence.uats.map((uat) => ({
      ...uat,
      status: "passed",
      messageIds: [`${uat.id}-message`],
      receiptIds: [`${uat.id}-receipt`],
      ...(uat.id.startsWith("quote-reply-") ? { nativeQuoteReply: proof } : {}),
    }));

    expect(validateEvidence(plan, evidence)).toMatchObject({
      ok: true,
      environment: "dev",
      quoteReplyUats: ["quote-reply-direct", "quote-reply-group"],
    });
  });
});
