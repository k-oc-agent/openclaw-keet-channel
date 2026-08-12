import { createHash } from "node:crypto";

import { resolveKeetAccount, validateKeetAccount, type KeetAccountConfig } from "./config.js";

export type KeetInboundEvent = {
  accountId?: string | null;
  chatType: "direct" | "group";
  conversationId: string;
  senderId: string;
  messageId?: string | null;
  text: string;
  timestampMs?: number;
  mentioned?: boolean;
};

export type KeetInboundRoute = {
  allowed: boolean;
  reason?: string;
  accountId: string;
  routeKey?: string;
  sessionKey?: string;
};

export type KeetInboundStateRecord = {
  key: string;
  channel: "keet";
  accountId: string;
  chatType: "direct" | "group";
  conversationId: string;
  senderId: string;
  messageId?: string;
  timestampMs?: number;
  textSha256: string;
  textLength: number;
  routeKey?: string;
  accepted: boolean;
  reason?: string;
};

export type KeetInboundDelivery = {
  accountId: string;
  chatType: "direct" | "group";
  sessionKey: string;
  routeKey: string;
  conversationId: string;
  senderId: string;
  messageId?: string;
  timestampMs?: number;
  text: string;
};

export type KeetInboundProcessResult = {
  deliveries: KeetInboundDelivery[];
  records: KeetInboundStateRecord[];
  seenKeys: Set<string>;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function routeSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function senderAllowed(senderId: string, allowFrom: string[]): boolean {
  return allowFrom.includes("*") || allowFrom.includes(senderId);
}

function reject(account: KeetAccountConfig, reason: string): KeetInboundRoute {
  return {
    allowed: false,
    reason,
    accountId: account.accountId,
  };
}

function allow(account: KeetAccountConfig, event: KeetInboundEvent): KeetInboundRoute {
  const routeKey = `keet:${routeSegment(account.accountId)}:${event.chatType}:${routeSegment(event.conversationId)}`;
  return {
    allowed: true,
    accountId: account.accountId,
    routeKey,
    sessionKey: `channel:${routeKey}`,
  };
}

function routeDirect(account: KeetAccountConfig, event: KeetInboundEvent): KeetInboundRoute {
  if (account.dmPolicy === "disabled") {
    return reject(account, "dm-disabled");
  }
  if (account.dmPolicy === "pairing") {
    return reject(account, "pairing-required");
  }
  if (!senderAllowed(event.senderId, account.allowFrom)) {
    return reject(account, "sender-not-allowlisted");
  }
  return allow(account, event);
}

function routeGroup(account: KeetAccountConfig, event: KeetInboundEvent): KeetInboundRoute {
  const group = account.groups[event.conversationId];
  if (!group) {
    return reject(account, "group-not-configured");
  }
  if (group.enabled === false) {
    return reject(account, "group-disabled");
  }
  if (group.requireMention && !event.mentioned) {
    return reject(account, "mention-required");
  }
  if (!senderAllowed(event.senderId, group.allowFrom ?? [])) {
    return reject(account, "sender-not-allowlisted");
  }
  return allow(account, event);
}

export function routeKeetInbound(cfg: unknown, event: KeetInboundEvent): KeetInboundRoute {
  const account = resolveKeetAccount(cfg, event.accountId);
  if (!account.enabled) {
    return reject(account, "account-disabled");
  }
  const validationError = validateKeetAccount(account);
  if (validationError) {
    return reject(account, validationError);
  }
  if (!event.conversationId.trim()) {
    return reject(account, "conversation-required");
  }
  if (!event.senderId.trim()) {
    return reject(account, "sender-required");
  }
  if (!event.text.trim()) {
    return reject(account, "text-required");
  }

  return event.chatType === "direct" ? routeDirect(account, event) : routeGroup(account, event);
}

export function dedupeKeyForInbound(event: KeetInboundEvent): string {
  const accountId = event.accountId ?? "default";
  const stableId = event.messageId?.trim()
    || sha256(`${event.conversationId}\0${event.senderId}\0${event.timestampMs ?? ""}\0${event.text}`);
  return `keet:${routeSegment(accountId)}:${event.chatType}:${routeSegment(event.conversationId)}:${stableId}`;
}

export function buildInboundStateRecord(
  event: KeetInboundEvent,
  route: KeetInboundRoute,
): KeetInboundStateRecord {
  return {
    key: dedupeKeyForInbound(event),
    channel: "keet",
    accountId: route.accountId,
    chatType: event.chatType,
    conversationId: event.conversationId,
    senderId: event.senderId,
    messageId: event.messageId?.trim() || undefined,
    timestampMs: event.timestampMs,
    textSha256: sha256(event.text),
    textLength: event.text.length,
    routeKey: route.routeKey,
    accepted: route.allowed,
    reason: route.reason,
  };
}

export function processKeetInboundEvents(
  cfg: unknown,
  events: KeetInboundEvent[],
  seenKeys: Set<string> = new Set(),
): KeetInboundProcessResult {
  const nextSeenKeys = new Set(seenKeys);
  const deliveries: KeetInboundDelivery[] = [];
  const records: KeetInboundStateRecord[] = [];

  for (const event of events) {
    const key = dedupeKeyForInbound(event);
    if (nextSeenKeys.has(key)) {
      continue;
    }
    nextSeenKeys.add(key);

    const route = routeKeetInbound(cfg, event);
    const record = buildInboundStateRecord(event, route);
    records.push(record);

    if (route.allowed && route.sessionKey && route.routeKey) {
      deliveries.push({
        accountId: route.accountId,
        chatType: event.chatType,
        sessionKey: route.sessionKey,
        routeKey: route.routeKey,
        conversationId: event.conversationId,
        senderId: event.senderId,
        messageId: event.messageId?.trim() || undefined,
        timestampMs: event.timestampMs,
        text: event.text,
      });
    }
  }

  return {
    deliveries,
    records,
    seenKeys: nextSeenKeys,
  };
}
