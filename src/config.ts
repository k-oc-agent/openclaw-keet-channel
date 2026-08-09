export const CHANNEL_ID = "keet";
export const DEFAULT_ACCOUNT_ID = "default";

export type KeetDmPolicy = "pairing" | "allowlist" | "open" | "disabled";

export type KeetGroupConfig = {
  enabled?: boolean;
  allowFrom?: string[];
  requireMention?: boolean;
};

export type KeetAccountConfig = {
  accountId: string;
  enabled: boolean;
  name?: string;
  profileDir?: string;
  stateDir?: string;
  bridgeCommand?: string;
  dmPolicy: KeetDmPolicy;
  allowFrom: string[];
  defaultTo?: string;
  groups: Record<string, KeetGroupConfig>;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function readDmPolicy(value: unknown): KeetDmPolicy {
  if (value === "allowlist" || value === "open" || value === "disabled") {
    return value;
  }
  return "pairing";
}

function keetSection(cfg: unknown): UnknownRecord {
  const root = readRecord(cfg);
  const channels = readRecord(root.channels);
  return readRecord(channels.keet);
}

function accountSections(section: UnknownRecord): Record<string, UnknownRecord> {
  const accounts = readRecord(section.accounts);
  return Object.fromEntries(
    Object.entries(accounts).filter((entry): entry is [string, UnknownRecord] => isRecord(entry[1])),
  );
}

function resolveRawAccount(section: UnknownRecord, accountId?: string | null): [string, UnknownRecord] {
  const accounts = accountSections(section);
  const configuredDefault = readString(section.defaultAccount);
  const selected = accountId ?? configuredDefault ?? Object.keys(accounts)[0] ?? DEFAULT_ACCOUNT_ID;
  return [selected, accounts[selected] ?? section];
}

export function listKeetAccountIds(cfg: unknown): string[] {
  const accounts = Object.keys(accountSections(keetSection(cfg)));
  return accounts.length > 0 ? accounts : [DEFAULT_ACCOUNT_ID];
}

export function defaultKeetAccountId(cfg: unknown): string {
  const section = keetSection(cfg);
  return readString(section.defaultAccount) ?? listKeetAccountIds(cfg)[0] ?? DEFAULT_ACCOUNT_ID;
}

export function resolveKeetAccount(cfg: unknown, accountId?: string | null): KeetAccountConfig {
  const section = keetSection(cfg);
  const [selectedAccountId, raw] = resolveRawAccount(section, accountId);
  const groups = Object.fromEntries(
    Object.entries(readRecord(raw.groups)).filter((entry): entry is [string, KeetGroupConfig] =>
      isRecord(entry[1]),
    ),
  );

  return {
    accountId: selectedAccountId,
    enabled: raw.enabled !== false && section.enabled !== false,
    name: readString(raw.name),
    profileDir: readString(raw.profileDir) ?? readString(section.profileDir),
    stateDir: readString(raw.stateDir) ?? readString(section.stateDir),
    bridgeCommand: readString(raw.bridgeCommand) ?? readString(section.bridgeCommand),
    dmPolicy: readDmPolicy(raw.dmPolicy ?? section.dmPolicy),
    allowFrom: readStringArray(raw.allowFrom ?? section.allowFrom),
    defaultTo: readString(raw.defaultTo ?? section.defaultTo),
    groups,
  };
}

export function validateKeetAccount(account: KeetAccountConfig): string | null {
  if (!account.bridgeCommand) {
    return "bridgeCommand is required for the bridge-cli MVP transport";
  }
  if (account.dmPolicy === "open" && !account.allowFrom.includes("*")) {
    return "dmPolicy=open requires allowFrom to contain '*' explicitly";
  }
  return null;
}

export function isKeetAccountConfigured(account: KeetAccountConfig): boolean {
  return validateKeetAccount(account) === null;
}

export function sanitizeKeetAccountForStatus(account: KeetAccountConfig): Record<string, unknown> {
  return {
    accountId: account.accountId,
    name: account.name,
    configured: isKeetAccountConfigured(account),
    enabled: account.enabled,
    dmPolicy: account.dmPolicy,
    hasProfileDir: Boolean(account.profileDir),
    hasStateDir: Boolean(account.stateDir),
    hasBridgeCommand: Boolean(account.bridgeCommand),
    groups: Object.keys(account.groups).length,
  };
}
