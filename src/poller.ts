import { resolveKeetAccount, validateKeetAccount } from "./config.js";
import {
  processKeetInboundEvents,
  type KeetInboundProcessResult,
} from "./inbound.js";
import {
  pollInboundWithBridgeCli,
  type BridgeCliRun,
} from "./transport.js";

export type KeetInboundPollBatchParams = {
  cfg: unknown;
  accountId?: string | null;
  cursor?: string | null;
  limit?: number;
  seenKeys?: Set<string>;
  signal?: AbortSignal;
  run?: BridgeCliRun;
};

export type KeetInboundPollBatch = {
  cursor?: string;
  processed: KeetInboundProcessResult;
  raw?: unknown;
};

export async function pollKeetInboundBatch(
  params: KeetInboundPollBatchParams,
): Promise<KeetInboundPollBatch> {
  const account = resolveKeetAccount(params.cfg, params.accountId);
  const validationError = validateKeetAccount(account);
  if (validationError) {
    throw new Error(validationError);
  }

  const polled = await pollInboundWithBridgeCli({
    bridgeCommand: account.bridgeCommand!,
    accountId: account.accountId,
    cursor: params.cursor,
    limit: params.limit,
    signal: params.signal,
    run: params.run,
  });

  return {
    cursor: polled.cursor,
    processed: processKeetInboundEvents(params.cfg, polled.events, params.seenKeys),
    raw: polled.raw,
  };
}
