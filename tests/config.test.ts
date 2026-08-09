import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCOUNT_ID,
  listKeetAccountIds,
  resolveKeetAccount,
  sanitizeKeetAccountForStatus,
  validateKeetAccount,
} from "../src/config.js";

describe("Keet channel config", () => {
  it("resolves a default account from channels.keet.accounts", () => {
    const cfg = {
      channels: {
        keet: {
          defaultAccount: "lab",
          accounts: {
            lab: {
              enabled: true,
              name: "Lab",
              profileDir: "/opt/openclaw/keet/profile",
              stateDir: "/opt/openclaw/keet/bridge",
              bridgeCommand: "/usr/local/bin/keet-bridge",
              dmPolicy: "allowlist",
              allowFrom: ["plak0815"],
              defaultTo: "Plak",
            },
          },
        },
      },
    };

    expect(listKeetAccountIds(cfg)).toEqual(["lab"]);
    expect(resolveKeetAccount(cfg)).toMatchObject({
      accountId: "lab",
      enabled: true,
      dmPolicy: "allowlist",
      allowFrom: ["plak0815"],
      bridgeCommand: "/usr/local/bin/keet-bridge",
    });
  });

  it("falls back to the default account id for legacy single-account config", () => {
    const cfg = {
      channels: {
        keet: {
          enabled: true,
          bridgeCommand: "/usr/local/bin/keet-bridge",
          dmPolicy: "pairing",
        },
      },
    };

    expect(listKeetAccountIds(cfg)).toEqual([DEFAULT_ACCOUNT_ID]);
    expect(resolveKeetAccount(cfg, DEFAULT_ACCOUNT_ID)).toMatchObject({
      accountId: DEFAULT_ACCOUNT_ID,
      enabled: true,
      dmPolicy: "pairing",
    });
  });

  it("rejects open DMs unless the wildcard allowlist is explicit", () => {
    const account = resolveKeetAccount({
      channels: {
        keet: {
          accounts: {
            lab: {
              enabled: true,
              bridgeCommand: "/usr/local/bin/keet-bridge",
              dmPolicy: "open",
              allowFrom: ["plak0815"],
            },
          },
        },
      },
    });

    expect(validateKeetAccount(account)).toEqual(
      "dmPolicy=open requires allowFrom to contain '*' explicitly",
    );
  });

  it("does not expose filesystem paths in status summaries", () => {
    const account = resolveKeetAccount({
      channels: {
        keet: {
          profileDir: "/very/private/profile",
          stateDir: "/very/private/state",
          bridgeCommand: "/usr/local/bin/keet-bridge",
        },
      },
    });

    expect(sanitizeKeetAccountForStatus(account)).toEqual({
      accountId: DEFAULT_ACCOUNT_ID,
      configured: true,
      enabled: true,
      dmPolicy: "pairing",
      hasProfileDir: true,
      hasStateDir: true,
      hasBridgeCommand: true,
      groups: 0,
    });
  });
});
