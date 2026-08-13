export type JoinDiagnosticStatus = "blocked" | "already-joined" | "unknown";

export type JoinDiagnosticReason =
  | "autobase-closing"
  | "membership-readback"
  | "unclassified";

export interface JoinDiagnosticResult {
  status: JoinDiagnosticStatus;
  reason: JoinDiagnosticReason;
  signatures: string[];
  safeSummary: string;
  nextGate: string;
  redactedLog: string;
}

const AUTObASE_CLOSING_SIGNATURES = [
  "startPairingRoom",
  "_startPairing",
  "UNEXPECTED_ERROR: Autobase is closing",
] as const;

const MEMBERSHIP_SIGNATURES = ["memberCount >= 2", "You joined the group"] as const;

export function redactJoinLog(log: string): string {
  return log
    .replace(/keet:\/\/[^\s"'`)<]+/g, "keet://<redacted>")
    .replace(/\b(qrPayload|inviteLink|recoveryPhrase)\s*[:=]\s*.*/gi, "$1: <redacted>");
}

export function classifyJoinLog(log: string): JoinDiagnosticResult {
  const redactedLog = redactJoinLog(log);
  const autobaseSignatures = AUTObASE_CLOSING_SIGNATURES.filter((signature) =>
    log.includes(signature),
  );

  if (autobaseSignatures.length > 0 && log.includes("Autobase is closing")) {
    return {
      status: "blocked",
      reason: "autobase-closing",
      signatures: [...AUTObASE_CLOSING_SIGNATURES],
      safeSummary:
        "Keet pairing failed because Autobase is closing during startPairingRoom/_startPairing.",
      nextGate:
        "Do not clean or reset the Keet profile without explicit approval; collect redacted logs and choose a bounded recovery path first.",
      redactedLog,
    };
  }

  const hasMemberCount =
    /\bmemberCount\b\s*[:=]\s*([2-9]|\d{2,})\b/.test(log) || log.includes("memberCount >= 2");
  const hasJoinedSignal = /You joined the group|already joined|memberCount >= 2/i.test(log);
  if (hasMemberCount && hasJoinedSignal) {
    return {
      status: "already-joined",
      reason: "membership-readback",
      signatures: [...MEMBERSHIP_SIGNATURES].filter((signature) =>
        signature === "memberCount >= 2" ? hasMemberCount : log.includes(signature),
      ),
      safeSummary: "Membership readback shows the local Keet identity is already in the room.",
      nextGate:
        "Do not retry the invite path; verify the intended target room name before enabling any group allowlist.",
      redactedLog,
    };
  }

  return {
    status: "unknown",
    reason: "unclassified",
    signatures: [],
    safeSummary: "Join evidence did not match a known safe pass or known blocked failure.",
    nextGate:
      "Stop and record only redacted evidence before choosing another join or recovery attempt.",
    redactedLog,
  };
}
