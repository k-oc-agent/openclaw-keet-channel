import {
  buildJsonChannelConfigSchema,
  createChatChannelPlugin,
  defineChannelPluginEntry,
  type ChannelAccountSnapshot,
  type ChannelPlugin,
} from "openclaw/plugin-sdk/core";

import { keetMessageActions } from "./actions.js";
import {
  defaultKeetAccountId,
  isKeetAccountConfigured,
  listKeetAccountIds,
  resolveKeetAccount,
  sanitizeKeetAccountForStatus,
  validateKeetAccount,
  type KeetAccountConfig,
} from "./config.js";
import { createKeetGatewayAdapter } from "./gateway.js";
import { keetMessageAdapter } from "./message-adapter.js";
import {
  inferKeetTargetChatType,
  looksLikeKeetTargetId,
  resolveKeetMessagingTarget,
  resolveKeetOutboundSessionRoute,
} from "./targets.js";
export {
  buildInboundStateRecord,
  dedupeKeyForInbound,
  processKeetInboundEvents,
  routeKeetInbound,
  type KeetInboundDelivery,
  type KeetInboundEvent,
  type KeetInboundProcessResult,
  type KeetInboundRoute,
  type KeetInboundStateRecord,
} from "./inbound.js";
export {
  createKeetGatewayAdapter,
  pollAndDispatchKeetInbound,
  type KeetDeliveryDispatchContext,
  type KeetGatewayAdapter,
  type KeetGatewayPollDeps,
  type KeetGatewayPollParams,
  type KeetGatewayPollResult,
  type KeetGatewayPollState,
  type KeetGatewayStatusSink,
} from "./gateway.js";
export {
  pollKeetInboundBatch,
  type KeetInboundPollBatch,
  type KeetInboundPollBatchParams,
} from "./poller.js";

const keetConfigSchema = buildJsonChannelConfigSchema({
  type: "object",
  additionalProperties: false,
  properties: {},
});

function accountSnapshot(account: KeetAccountConfig): ChannelAccountSnapshot {
  return sanitizeKeetAccountForStatus(account) as ChannelAccountSnapshot;
}

export const keetChannelPlugin: ChannelPlugin<KeetAccountConfig> = createChatChannelPlugin<KeetAccountConfig>({
  base: {
    id: "keet",
    meta: {
      id: "keet",
      label: "Keet",
      selectionLabel: "Keet",
      docsPath: "/plugins/community#keet",
      blurb: "P2P Keet messaging channel.",
      markdownCapable: false,
    },
    capabilities: {
      chatTypes: ["direct", "group"],
      media: false,
      reactions: false,
    },
    configSchema: keetConfigSchema,
    config: {
      listAccountIds: listKeetAccountIds,
      defaultAccountId: defaultKeetAccountId,
      resolveAccount: resolveKeetAccount,
      isEnabled: (account) => account.enabled,
      isConfigured: isKeetAccountConfigured,
      unconfiguredReason: (account) => validateKeetAccount(account) ?? "Keet account is not configured",
      inspectAccount: (cfg, accountId) => sanitizeKeetAccountForStatus(resolveKeetAccount(cfg, accountId)),
      describeAccount: accountSnapshot,
      resolveAllowFrom: ({ cfg, accountId }) => resolveKeetAccount(cfg, accountId).allowFrom,
      resolveDefaultTo: ({ cfg, accountId }) => resolveKeetAccount(cfg, accountId).defaultTo,
    },
    setup: {
      applyAccountConfig: ({ cfg }) => cfg,
    },
    status: {
      buildChannelSummary: ({ account }) => sanitizeKeetAccountForStatus(account),
      resolveAccountState: ({ configured, enabled }) => {
        if (!enabled) {
          return "disabled";
        }
        return configured ? "configured" : "not configured";
      },
    },
    message: keetMessageAdapter,
    actions: keetMessageActions,
    messaging: {
      targetPrefixes: ["keet"],
      inferTargetChatType: inferKeetTargetChatType,
      resolveOutboundSessionRoute: resolveKeetOutboundSessionRoute,
      targetResolver: {
        looksLikeId: looksLikeKeetTargetId,
        hint: "<peer-id|keet:peer-id|keet:group:name>",
        resolveTarget: resolveKeetMessagingTarget,
      },
    },
    gateway: createKeetGatewayAdapter(),
  },
  security: {
    dm: {
      channelKey: "keet",
      resolvePolicy: (account) => account.dmPolicy,
      resolveAllowFrom: (account) => account.allowFrom,
      allowFromPathSuffix: "allowFrom",
      policyPathSuffix: "dmPolicy",
      approveHint: "Add the Keet peer id to channels.keet.accounts.<account>.allowFrom.",
    },
  },
});

const entry: unknown = defineChannelPluginEntry({
  id: "keet",
  name: "Keet",
  description: "OpenClaw channel plugin for Keet/Holepunch messaging.",
  plugin: keetChannelPlugin,
  configSchema: keetConfigSchema,
});

export default entry;
