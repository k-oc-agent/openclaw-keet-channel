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
  assertSecretSafeEvidence(plan);
  return {
    ok: true,
    environments: names,
    uatCount: plan.environments.reduce((count, env) => count + env.uats.length, 0),
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
    uats: env.uats.map((id) => ({ id, status: "pending", messageIds: [], receiptIds: [] })),
    cleanup: {
      stopKeetProcesses: "required",
      noCdpProcessesLeftRunning: "required",
    },
  };
  assertSecretSafeEvidence(evidence);
  return evidence;
}

function parseCli(argv) {
  const [action = "validate", ...rest] = argv;
  const params = { action, plan: DEFAULT_PLAN, environment: undefined };
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
    } else {
      throw new Error(`unsupported action ${params.action}`);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
