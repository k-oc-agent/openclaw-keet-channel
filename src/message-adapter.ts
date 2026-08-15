import {
  createMessageReceiptFromOutboundResults,
  defineChannelMessageAdapter,
} from "openclaw/plugin-sdk/channel-outbound";

import { resolveKeetAccount, validateKeetAccount } from "./config.js";
import { sendTextWithBridgeCli, type KeetSendReceipt } from "./transport.js";

export type KeetSendTextContext = {
  cfg: unknown;
  to: string;
  text: string;
  replyToId?: string | null;
  accountId?: string | null;
  signal?: AbortSignal;
};

export type KeetMessageAdapterDeps = {
  sendText?: (ctx: KeetSendTextContext) => Promise<KeetSendReceipt>;
  now?: () => number;
  duplicateWindowMs?: number;
};

type SentCacheEntry = {
  at: number;
  sent: KeetSendReceipt;
};

async function defaultSendText(ctx: KeetSendTextContext): Promise<KeetSendReceipt> {
  const account = resolveKeetAccount(ctx.cfg, ctx.accountId);
  const validationError = validateKeetAccount(account);
  if (validationError) {
    throw new Error(validationError);
  }

  return sendTextWithBridgeCli({
    bridgeCommand: account.bridgeCommand!,
    to: ctx.to,
    text: ctx.text,
    replyToId: ctx.replyToId,
    signal: ctx.signal,
  });
}

export function createKeetMessageAdapter(deps: KeetMessageAdapterDeps = {}) {
  const sendText = deps.sendText ?? defaultSendText;
  const now = deps.now ?? Date.now;
  const duplicateWindowMs = deps.duplicateWindowMs ?? 120_000;
  const recentlySent = new Map<string, SentCacheEntry>();

  return defineChannelMessageAdapter({
    id: "keet",
    durableFinal: {
      capabilities: {
        text: true,
        media: false,
        poll: false,
        replyTo: true,
        thread: false,
        messageSendingHooks: true,
      },
    },
    send: {
      text: async ({ cfg, to, text, replyToId, accountId, signal }) => {
        if (isInternalOpenClawStatusText(text)) {
          throw new Error("Refusing to send internal OpenClaw status text to Keet");
        }

        const key = outboundDuplicateKey({
          accountId,
          to,
          text,
          replyToId,
        });
        const sentAt = now();
        const cached = recentlySent.get(key);
        const sent = cached && sentAt - cached.at <= duplicateWindowMs
          ? cached.sent
          : await sendText({
            cfg,
            to,
            text,
            replyToId,
            accountId,
            signal,
          });
        recentlySent.set(key, { at: sentAt, sent });

        return {
          receipt: createMessageReceiptFromOutboundResults({
            results: [
              {
                channel: "keet",
                messageId: sent.messageId,
                conversationId: sent.conversationId,
              },
            ],
            kind: "text",
            replyToId: replyToId ?? undefined,
          }),
        };
      },
    },
  });
}

function outboundDuplicateKey(params: {
  accountId?: string | null;
  to: string;
  text: string;
  replyToId?: string | null;
}): string {
  return [
    params.accountId?.trim() || "default",
    params.to.trim(),
    params.replyToId?.trim() || "",
    params.text,
  ].join("\0");
}

function isInternalOpenClawStatusText(text: string): boolean {
  const normalized = text.trim();
  return /^Model Fallback:/i.test(normalized)
    || /^Tool Fallback:/i.test(normalized)
    || /^Provider Fallback:/i.test(normalized)
    || /^Bash (run|failed|search):/i.test(normalized)
    || /^Snapping$/i.test(normalized);
}

export const keetMessageAdapter = createKeetMessageAdapter();
