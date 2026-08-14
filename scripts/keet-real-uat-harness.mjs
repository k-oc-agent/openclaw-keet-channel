#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const DEFAULT_PLAN = "docs/uat/persistent-dev-stage-plan.json";
const REQUIRED_UATS = [
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
];
const QUOTE_REPLY_UATS = ["quote-reply-direct", "quote-reply-group"];
const PROCESSING_UATS = [
  "openclaw-process-direct",
  "openclaw-process-native-reply-direct",
  "openclaw-process-group",
];
const PROCESSING_EXPECTATIONS = {
  "openclaw-process-direct": "direct",
  "openclaw-process-native-reply-direct": "direct",
  "openclaw-process-group": "group",
  "prod-fresh-dm-inbound-process": "direct",
  "prod-fresh-canary-inbound-process": "group",
};
const REQUIRED_PROD_SMOKES = [
  "prod-fresh-dm-inbound-process",
  "prod-fresh-canary-inbound-process",
  "prod-native-quote-reply-dm-inbound",
  "prod-native-quote-reply-group",
  "prod-canary-normal-outbound",
];
const PROD_PROCESSING_SMOKES = [
  "prod-fresh-dm-inbound-process",
  "prod-fresh-canary-inbound-process",
];
const SECRET_KEY_PATTERNS = [
  /backup[_-]?password/i,
  /recovery[_-]?phrase$/i,
  /^phrase$/i,
  /invite[_-]?(link|url|secret)?$/i,
  /qr[_-]?payload/i,
  /raw[_-]?key/i,
  /private[_-]?key/i,
];
const SECRET_VALUE_PATTERNS = [
  /keet:\/\/invite\/[^\s"']+/i,
  /\b(?:[a-z]+[\s-]+){11,}[a-z]+\b/i,
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assertSafeKey(key) {
  const normalized = key.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  if (/(length|sha256|hash|path|profile|openbao|metadata)/.test(normalized)) {
    return;
  }
  if (SECRET_KEY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new Error(`No Secret Evidence Guard rejected secret key: ${key}`);
  }
}

export function assertSecretSafeEvidence(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSecretSafeEvidence(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      assertSafeKey(key);
      assertSecretSafeEvidence(nested, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string") {
    for (const pattern of SECRET_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        throw new Error(`No Secret Evidence Guard rejected secret-looking value at ${path}`);
      }
    }
  }
}

export async function loadPlan(planPath = DEFAULT_PLAN) {
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  assertSecretSafeEvidence(plan);
  return plan;
}

function requireString(value, message) {
  const trimmed = readString(value);
  if (!trimmed) {
    throw new Error(message);
  }
  return trimmed;
}

function requireBooleanTrue(value, message) {
  if (value !== true) {
    throw new Error(message);
  }
}

function requireSha256(value, message) {
  const trimmed = requireString(value, message);
  if (!/^[a-f0-9]{64}$/i.test(trimmed)) {
    throw new Error(message);
  }
  return trimmed;
}

function validateAccount(env, account) {
  const role = requireString(account.role, `environment ${env.name} account is missing role`);
  if (!["a", "b"].includes(role)) {
    throw new Error(`environment ${env.name} account role must be a or b`);
  }
  const openBaoPath = requireString(account.openBaoPath, `environment ${env.name} account ${role} is missing OpenBao path`);
  const expectedPrefix = `kv/data/openclaw/keet/${env.name}/test-`;
  if (!openBaoPath.startsWith(expectedPrefix)) {
    throw new Error(`environment ${env.name} account ${role} OpenBao path must start with ${expectedPrefix}`);
  }
  const profilePath = requireString(account.profilePath, `environment ${env.name} account ${role} is missing profile path`);
  const expectedProfilePrefix = `/opt/openclaw/keet-test-identities/${env.name}/test-`;
  if (!profilePath.startsWith(expectedProfilePrefix)) {
    throw new Error(`environment ${env.name} account ${role} profile path must start with ${expectedProfilePrefix}`);
  }
  const recoveryPhraseLength = Number(account.recoveryPhraseLength);
  if (recoveryPhraseLength !== 24) {
    throw new Error(`environment ${env.name} account ${role} must record recoveryPhraseLength=24`);
  }
  requireString(account.displayName, `environment ${env.name} account ${role} is missing display name`);
  requireString(account.username, `environment ${env.name} account ${role} is missing username`);
}

function validateEnvironment(env) {
  const name = requireString(env.name, "environment is missing name");
  if (!["dev", "stage"].includes(name)) {
    throw new Error(`unsupported environment ${name}`);
  }
  const host = requireString(env.host, `environment ${name} is missing host`);
  if (host !== `k-${name}`) {
    throw new Error(`environment ${name} host must be k-${name}`);
  }
  if (!Array.isArray(env.accounts) || env.accounts.length !== 2) {
    throw new Error(`environment ${name} must define two accounts`);
  }
  env.accounts.forEach((account) => validateAccount(env, account));
  const roles = env.accounts.map((account) => account.role).sort().join(",");
  if (roles !== "a,b") {
    throw new Error(`environment ${name} must define account roles a and b`);
  }
  if (!Array.isArray(env.uats)) {
    throw new Error(`environment ${name} must define UAT ids`);
  }
  for (const required of REQUIRED_UATS) {
    if (!env.uats.includes(required)) {
      throw new Error(`environment ${name} missing required UAT ${required}`);
    }
  }
  requireString(env.groupChat, `environment ${name} is missing group chat`);
  requireString(env.bridgeConfigPath, `environment ${name} is missing bridge config path`);
}

export function validatePlan(plan) {
  if (!Array.isArray(plan.environments) || plan.environments.length !== 2) {
    throw new Error("plan must define exactly two environments");
  }
  const names = plan.environments.map((env) => env.name);
  if (names.join(",") !== "dev,stage") {
    throw new Error("plan environments must be ordered dev,stage");
  }
  plan.environments.forEach(validateEnvironment);
  if (!plan.productionGate || typeof plan.productionGate !== "object") {
    throw new Error("plan must define productionGate");
  }
  if (!Array.isArray(plan.productionGate.requiredSmokes)) {
    throw new Error("plan productionGate must define requiredSmokes");
  }
  for (const required of REQUIRED_PROD_SMOKES) {
    if (!plan.productionGate.requiredSmokes.includes(required)) {
      throw new Error(`plan productionGate missing required smoke ${required}`);
    }
  }
  assertSecretSafeEvidence(plan);
  return {
    ok: true,
    environments: names,
    uatCount: plan.environments.reduce((count, env) => count + env.uats.length, 0),
    productionSmokeCount: plan.productionGate.requiredSmokes.length,
    openBaoPaths: plan.environments.flatMap((env) => env.accounts.map((account) => account.openBaoPath)),
    planSha256: sha256(JSON.stringify(plan)),
  };
}

export function buildEvidenceSkeleton(plan, environmentName) {
  const env = plan.environments.find((candidate) => candidate.name === environmentName);
  if (!env) {
    throw new Error(`unknown environment ${environmentName}`);
  }
  const evidence = {
    kind: "keet-real-uat-evidence",
    issue: plan.issue,
    environment: env.name,
    host: env.host,
    bridgeConfigPath: env.bridgeConfigPath,
    groupChat: env.groupChat,
    accounts: env.accounts.map((account) => ({
      role: account.role,
      displayName: account.displayName,
      username: account.username,
      openBaoPath: account.openBaoPath,
      profilePath: account.profilePath,
      recoveryPhraseLength: account.recoveryPhraseLength,
    })),
    uats: env.uats.map((id) => ({
      id,
      status: "pending",
      messageIds: [],
      receiptIds: [],
      ...(QUOTE_REPLY_UATS.includes(id)
        ? {
          nativeQuoteReply: {
            verified: false,
            targetRoomVerified: false,
            absentFromWrongRoom: false,
            notPlainMessageOnly: false,
            quotedParentMessageId: "",
            replyMessageId: "",
            bodyTextSha256: "",
            quoteTextSha256: "",
          },
        }
        : {}),
      ...(PROCESSING_UATS.includes(id)
        ? {
          openClawProcessing: {
            freshInbound: false,
            processedByOpenClaw: false,
            routeKind: PROCESSING_EXPECTATIONS[id],
            routeKey: "",
            sessionId: "",
            sessionKey: "",
            inboundMessageId: "",
            processingStatus: "",
            outboundReplyReceiptId: "",
            replyMessageId: "",
            targetRoomVerified: false,
            absentFromWrongRoom: false,
            answerMatchesPrompt: false,
            responseTextSha256: "",
          },
        }
        : {}),
    })),
    cleanup: {
      stopKeetProcesses: "required",
      noCdpProcessesLeftRunning: "required",
    },
  };
  assertSecretSafeEvidence(evidence);
  return evidence;
}

export function buildProdEvidenceSkeleton(plan) {
  const evidence = {
    kind: "keet-prod-smoke-evidence",
    issue: plan.issue,
    productionGate: plan.productionGate.issue,
    requiredSmokes: plan.productionGate.requiredSmokes.map((id) => ({
      id,
      status: "pending",
      messageIds: [],
      receiptIds: [],
      ...(PROD_PROCESSING_SMOKES.includes(id)
        ? {
          openClawProcessing: {
            freshInbound: false,
            processedByOpenClaw: false,
            routeKind: PROCESSING_EXPECTATIONS[id],
            routeKey: "",
            sessionId: "",
            sessionKey: "",
            inboundMessageId: "",
            processingStatus: "",
            outboundReplyReceiptId: "",
            replyMessageId: "",
            targetRoomVerified: false,
            absentFromWrongRoom: false,
            answerMatchesPrompt: false,
            responseTextSha256: "",
          },
        }
        : {}),
    })),
    postRestartReadback: {
      gatewayHealthy: false,
      pluginVersion: "",
      channelHealthy: false,
    },
  };
  assertSecretSafeEvidence(evidence);
  return evidence;
}

function findEnvironment(plan, name) {
  const env = plan.environments.find((candidate) => candidate.name === name);
  if (!env) {
    throw new Error(`unknown evidence environment ${name}`);
  }
  return env;
}

function validateQuoteReplyProof(uat, environmentName) {
  const proof = uat.nativeQuoteReply && typeof uat.nativeQuoteReply === "object"
    ? uat.nativeQuoteReply
    : undefined;
  if (!proof) {
    throw new Error(`environment ${environmentName} ${uat.id} missing native quote reply proof`);
  }
  requireBooleanTrue(
    proof.verified,
    `environment ${environmentName} ${uat.id} must verify native quote reply structure`,
  );
  requireBooleanTrue(
    proof.targetRoomVerified,
    `environment ${environmentName} ${uat.id} must verify the target room read-only`,
  );
  requireBooleanTrue(
    proof.absentFromWrongRoom,
    `environment ${environmentName} ${uat.id} must verify absence from the wrong room`,
  );
  requireBooleanTrue(
    proof.notPlainMessageOnly,
    `environment ${environmentName} ${uat.id} must prove the send is not a plain message only`,
  );
  requireString(
    proof.quotedParentMessageId,
    `environment ${environmentName} ${uat.id} missing quoted parent message id`,
  );
  requireString(proof.replyMessageId, `environment ${environmentName} ${uat.id} missing reply message id`);
  requireSha256(proof.bodyTextSha256, `environment ${environmentName} ${uat.id} missing body text sha256`);
  requireSha256(proof.quoteTextSha256, `environment ${environmentName} ${uat.id} missing quote text sha256`);
}

function validateProcessingProof(uat, contextName) {
  const proof = uat.openClawProcessing && typeof uat.openClawProcessing === "object"
    ? uat.openClawProcessing
    : undefined;
  if (!proof) {
    throw new Error(`${contextName} ${uat.id} missing OpenClaw processing proof`);
  }
  const expectedRouteKind = PROCESSING_EXPECTATIONS[uat.id];
  if (expectedRouteKind && proof.routeKind !== expectedRouteKind) {
    throw new Error(`${contextName} ${uat.id} must prove ${expectedRouteKind} route processing`);
  }
  requireBooleanTrue(proof.freshInbound, `${contextName} ${uat.id} must use a fresh inbound message`);
  requireBooleanTrue(proof.processedByOpenClaw, `${contextName} ${uat.id} must prove OpenClaw processed the event`);
  requireString(proof.routeKey, `${contextName} ${uat.id} missing route key`);
  if (!readString(proof.sessionId) && !readString(proof.sessionKey)) {
    throw new Error(`${contextName} ${uat.id} missing session id or session key`);
  }
  requireString(proof.inboundMessageId, `${contextName} ${uat.id} missing inbound message id`);
  if (proof.processingStatus !== "processed") {
    throw new Error(`${contextName} ${uat.id} processing status must be processed`);
  }
  requireString(proof.outboundReplyReceiptId, `${contextName} ${uat.id} missing outbound reply receipt id`);
  requireString(proof.replyMessageId, `${contextName} ${uat.id} missing reply message id`);
  requireBooleanTrue(proof.targetRoomVerified, `${contextName} ${uat.id} must verify reply target room`);
  requireBooleanTrue(proof.absentFromWrongRoom, `${contextName} ${uat.id} must verify wrong-room absence`);
  requireBooleanTrue(proof.answerMatchesPrompt, `${contextName} ${uat.id} must prove the answer matches the prompt`);
  requireSha256(proof.responseTextSha256, `${contextName} ${uat.id} missing response text sha256`);
}

export function validateEvidence(plan, evidence) {
  assertSecretSafeEvidence(evidence);
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new Error("evidence must be an object");
  }
  if (evidence.kind !== "keet-real-uat-evidence") {
    throw new Error("evidence kind must be keet-real-uat-evidence");
  }
  const env = findEnvironment(plan, requireString(evidence.environment, "evidence missing environment"));
  if (!Array.isArray(evidence.uats)) {
    throw new Error(`environment ${env.name} evidence must include UAT results`);
  }
  const byId = new Map(evidence.uats.map((uat) => [uat?.id, uat]));
  for (const required of env.uats) {
    const uat = byId.get(required);
    if (!uat) {
      throw new Error(`environment ${env.name} missing evidence for UAT ${required}`);
    }
    if (uat.status !== "passed") {
      throw new Error(`environment ${env.name} UAT ${required} must be passed before gate`);
    }
    if (QUOTE_REPLY_UATS.includes(required)) {
      validateQuoteReplyProof(uat, env.name);
    }
    if (PROCESSING_UATS.includes(required)) {
      validateProcessingProof(uat, `environment ${env.name}`);
    }
  }
  return {
    ok: true,
    environment: env.name,
    uatCount: env.uats.length,
    quoteReplyUats: QUOTE_REPLY_UATS,
    processingUats: PROCESSING_UATS,
  };
}

export function validateProdEvidence(plan, evidence) {
  assertSecretSafeEvidence(evidence);
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new Error("production evidence must be an object");
  }
  if (evidence.kind !== "keet-prod-smoke-evidence") {
    throw new Error("production evidence kind must be keet-prod-smoke-evidence");
  }
  if (!Array.isArray(evidence.requiredSmokes)) {
    throw new Error("production evidence must include required smoke results");
  }
  const byId = new Map(evidence.requiredSmokes.map((smoke) => [smoke?.id, smoke]));
  for (const required of plan.productionGate.requiredSmokes) {
    const smoke = byId.get(required);
    if (!smoke) {
      throw new Error(`production evidence missing smoke ${required}`);
    }
    if (smoke.status !== "passed") {
      throw new Error(`production smoke ${required} must be passed before gate`);
    }
    if (PROD_PROCESSING_SMOKES.includes(required)) {
      validateProcessingProof(smoke, "production");
    }
  }
  return {
    ok: true,
    productionSmokeCount: plan.productionGate.requiredSmokes.length,
    processingSmokes: PROD_PROCESSING_SMOKES,
  };
}

function parseCli(argv) {
  const [action = "validate", ...rest] = argv;
  const params = { action, plan: DEFAULT_PLAN, environment: undefined, evidence: undefined };
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
    if (value === undefined) {
      throw new Error(`missing value for ${key}`);
    }
    if (key === "--plan") {
      params.plan = value;
    } else if (key === "--environment") {
      params.environment = value;
    } else if (key === "--evidence") {
      params.evidence = value;
    } else {
      throw new Error(`unsupported option ${key}`);
    }
  }
  return params;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const params = parseCli(process.argv.slice(2));
    const plan = await loadPlan(params.plan);
    const summary = validatePlan(plan);
    if (params.action === "validate") {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    } else if (params.action === "evidence-skeleton") {
      if (!params.environment) {
        throw new Error("evidence-skeleton requires --environment");
      }
      process.stdout.write(`${JSON.stringify(buildEvidenceSkeleton(plan, params.environment), null, 2)}\n`);
    } else if (params.action === "prod-evidence-skeleton") {
      process.stdout.write(`${JSON.stringify(buildProdEvidenceSkeleton(plan), null, 2)}\n`);
    } else if (params.action === "validate-evidence") {
      if (!params.evidence) {
        throw new Error("validate-evidence requires --evidence");
      }
      const evidence = JSON.parse(await readFile(params.evidence, "utf8"));
      process.stdout.write(`${JSON.stringify(validateEvidence(plan, evidence), null, 2)}\n`);
    } else if (params.action === "validate-prod-evidence") {
      if (!params.evidence) {
        throw new Error("validate-prod-evidence requires --evidence");
      }
      const evidence = JSON.parse(await readFile(params.evidence, "utf8"));
      process.stdout.write(`${JSON.stringify(validateProdEvidence(plan, evidence), null, 2)}\n`);
    } else {
      throw new Error(`unsupported action ${params.action}`);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
