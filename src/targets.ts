import {
  buildChannelOutboundSessionRoute,
  type OpenClawConfig,
} from "openclaw/plugin-sdk/core";

import { CHANNEL_ID, defaultKeetAccountId, resolveKeetAccount } from "./config.js";

export type KeetTargetKind = "user" | "group";

type ResolvedKeetTarget = {
  to: string;
  kind: KeetTargetKind;
  display?: string;
};

function stripPrefix(value: string, prefix: string): string | null {
  const trimmed = value.trim();
  return trimmed.toLowerCase().startsWith(prefix)
    ? trimmed.slice(prefix.length).trim()
    : null;
}

function parseRuntimeConversationTarget(value: string): ResolvedKeetTarget | null {
  const target = stripPrefix(value, "channel:keet:");
  if (target === null) {
    return null;
  }
  const parts = target.split(":");
  const chatType = parts[1];
  const conversationId = parts.slice(2).join(":").trim();
  if (!conversationId) {
    return null;
  }
  if (chatType === "direct") {
    return { to: conversationId, kind: "user", display: conversationId };
  }
  if (chatType === "group") {
    return { to: conversationId, kind: "group", display: conversationId };
  }
  return null;
}

export function normalizeKeetMessageTarget(input: string): ResolvedKeetTarget | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const runtimeTarget = parseRuntimeConversationTarget(trimmed);
  if (runtimeTarget) {
    return runtimeTarget;
  }

  const groupTarget = stripPrefix(trimmed, "keet:group:");
  if (groupTarget) {
    return { to: groupTarget, kind: "group", display: groupTarget };
  }

  const directTarget = stripPrefix(trimmed, "keet:direct:");
  if (directTarget) {
    return { to: directTarget, kind: "user", display: directTarget };
  }

  const keetTarget = stripPrefix(trimmed, "keet:");
  if (keetTarget) {
    return { to: keetTarget, kind: "user", display: keetTarget };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return null;
  }

  return { to: trimmed, kind: "user", display: trimmed };
}

export function looksLikeKeetTargetId(raw: string): boolean {
  return normalizeKeetMessageTarget(raw) !== null;
}

export async function resolveKeetMessagingTarget(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
  input: string;
  normalized: string;
  preferredKind?: KeetTargetKind | "channel";
}): Promise<{
  to: string;
  kind: KeetTargetKind;
  display?: string;
  source: "normalized";
} | null> {
  const account = resolveKeetAccount(params.cfg, params.accountId);
  const target = normalizeKeetMessageTarget(params.input)
    ?? normalizeKeetMessageTarget(params.normalized);
  if (!target) {
    return null;
  }

  if (params.preferredKind === "group" || target.kind === "group") {
    const group = account.groups[target.to];
    if (group?.enabled === false) {
      return null;
    }
    if (group || target.kind === "group") {
      return { ...target, kind: "group", source: "normalized" };
    }
  }

  const knownDirectTarget =
    account.allowFrom.includes("*")
    || account.allowFrom.includes(target.to)
    || account.defaultTo === target.to;
  if (!knownDirectTarget && params.preferredKind === "user") {
    return null;
  }

  return { ...target, kind: "user", source: "normalized" };
}

export function inferKeetTargetChatType(params: { to: string }): "direct" | "group" | undefined {
  return normalizeKeetMessageTarget(params.to)?.kind === "group" ? "group" : "direct";
}

export function resolveKeetOutboundSessionRoute(params: {
  cfg: OpenClawConfig;
  agentId: string;
  accountId?: string | null;
  target: string;
}) {
  const resolved = normalizeKeetMessageTarget(params.target);
  if (!resolved) {
    return null;
  }
  const accountId = params.accountId ?? defaultKeetAccountId(params.cfg);
  const chatType = resolved.kind === "group" ? "group" : "direct";
  return buildChannelOutboundSessionRoute({
    cfg: params.cfg,
    agentId: params.agentId,
    channel: CHANNEL_ID,
    accountId,
    recipientSessionExact: chatType === "direct",
    peer: { kind: chatType, id: resolved.to },
    chatType,
    from: `keet:${accountId}`,
    to: resolved.to,
  });
}
