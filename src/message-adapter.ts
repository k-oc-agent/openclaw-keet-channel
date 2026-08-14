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
        const sent = await sendText({
          cfg,
          to,
          text,
          replyToId,
          accountId,
          signal,
        });

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

export const keetMessageAdapter = createKeetMessageAdapter();
