#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const DEFAULT_CDP_URL = process.env.KEET_CDP_URL || "http://127.0.0.1:9223";
const DEFAULT_CONFIG_PATH = process.env.KEET_BRIDGE_CONFIG || "/etc/openclaw/keet-bridge.json";

export const supportedActions = ["send", "poll"];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      if (!args.action) {
        args.action = arg;
      }
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readStringArray(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === "string" && entry.trim())
    : [];
}

export async function loadBridgeConfig(path = DEFAULT_CONFIG_PATH) {
  const text = await readFile(path, "utf8");
  return normalizeBridgeConfig(JSON.parse(text));
}

export function normalizeBridgeConfig(raw) {
  const config = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const aliases = config.sender_aliases && typeof config.sender_aliases === "object" && !Array.isArray(config.sender_aliases)
    ? Object.fromEntries(Object.entries(config.sender_aliases).map(([key, value]) => [String(key), String(value)]))
    : {};
  return {
    senderAliases: aliases,
    directPeers: Array.isArray(config.direct_peers) ? config.direct_peers : [],
    groupTopics: Array.isArray(config.group_topics) ? config.group_topics : [],
  };
}

export function enabledTargets(config) {
  const targets = [];
  for (const peer of config.directPeers ?? []) {
    if (!peer || typeof peer !== "object" || peer.enabled === false) {
      continue;
    }
    const chat = readString(peer.chat_name);
    const conversationId = readString(peer.peer_id);
    if (chat && conversationId) {
      targets.push({ chat, chatType: "direct", conversationId });
    }
  }
  for (const group of config.groupTopics ?? []) {
    if (!group || typeof group !== "object" || group.enabled === false) {
      continue;
    }
    const chat = readString(group.chat_name);
    const conversationId = readString(group.chat_id);
    if (chat && conversationId) {
      targets.push({
        chat,
        chatType: "group",
        conversationId,
        allowFrom: readStringArray(group.allowed_senders),
      });
    }
  }
  return targets;
}

export function resolveChatTarget(config, chat) {
  const requested = requireString(chat, "--chat");
  return enabledTargets(config).find((target) =>
    target.chat === requested || target.conversationId === requested,
  ) ?? targetFromChat(requested);
}

export function isOpenClawEchoText(text) {
  return typeof text === "string" && text.startsWith("K OpenClaw\n");
}

export function extractMessageBodyText(parts) {
  const normalized = Array.isArray(parts)
    ? parts
      .map((part) => ({
        text: typeof part?.text === "string" ? part.text.trim() : "",
        isReplyQuote: part?.isReplyQuote === true,
      }))
      .filter((part) => part.text)
    : [];
  const bodyParts = normalized.filter((part) => !part.isReplyQuote);
  return (bodyParts.at(-1) ?? normalized.at(-1))?.text ?? "";
}

export function eventFromRow(row, { target, aliases }) {
  if (row?.direction !== "incoming" || !row?.text) {
    return null;
  }
  const text = String(row.text);
  if (text.includes("keet://") || text.includes("Invite expires")) {
    return null;
  }
  if (isOpenClawEchoText(text)) {
    return null;
  }
  const sender = String(row.sender || target.conversationId);
  const normalizedSender = aliases[sender] ?? sender;
  if (
    target.chatType === "group"
    && Array.isArray(target.allowFrom)
    && target.allowFrom.length > 0
    && !target.allowFrom.includes(normalizedSender)
  ) {
    return null;
  }
  return {
    id: row.id,
    chatType: target.chatType,
    chat: target.conversationId,
    sender: normalizedSender,
    text,
    timestampMs: Number.isFinite(row.timestampMs) ? row.timestampMs : 0,
  };
}

export function selectVisibleEvents(events, { limit }) {
  const boundedLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 50, 100));
  return events.slice(Math.max(0, events.length - boundedLimit));
}

export function roomNameFromLines(lines) {
  const normalized = Array.isArray(lines)
    ? lines.map((line) => String(line).trim()).filter(Boolean)
    : [];
  const first = normalized[0] || "";
  const second = normalized[1] || "";
  return first.length <= 3 && second ? second : first;
}

export function isSelectedRoomItemClass(className) {
  const value = typeof className === "string" ? className : "";
  return value.includes("bg-grey600") && !value.includes("border-transparent");
}

export function activeRoomNameFromRoomItems(items) {
  const selected = Array.isArray(items)
    ? items.find((item) => item && isSelectedRoomItemClass(item.className))
    : undefined;
  return selected ? roomNameFromLines(selected.lines) : undefined;
}

export function assertExpectedActiveRoomName(activeRoomName, expectedRoomName, phase) {
  if (activeRoomName !== expectedRoomName) {
    throw new Error(
      `Keet CDP active room mismatch ${phase}: expected ${expectedRoomName}, active ${activeRoomName || "<none>"}`,
    );
  }
}

export function buildPollPayload(events, { limit }) {
  const selected = selectVisibleEvents(events, { limit });
  return {
    ok: true,
    poll: {
      cursor: String(events.length),
      events: selected,
    },
  };
}

function targetFromChat(chat) {
  return {
    chat,
    chatType: chat === "Plak" || chat === "plak0815" ? "direct" : "group",
    conversationId: chat === "Plak" ? "plak0815" : chat,
  };
}

async function withKeetPage(cdpUrl, fn) {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.connectOverCDP(cdpUrl);
  try {
    const context = browser.contexts()[0];
    const page = context.pages()[0];
    if (!page) {
      throw new Error("No Keet page found through CDP");
    }
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(500);
    return await fn(page);
  } finally {
    await browser.close();
  }
}

async function openChat(page, chatName) {
  const clicked = await page.evaluate((name) => {
    const roomItems = [...document.querySelectorAll('[data-testid="room-list-item"]')];
    for (const item of roomItems) {
      const lines = (item.innerText || "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      const first = lines[0] || "";
      const second = lines[1] || "";
      const roomName = first.length <= 3 && second ? second : first;
      if (roomName === name) {
        item.click();
        return true;
      }
    }
    return false;
  }, chatName);
  if (!clicked) {
    await page.getByText(chatName, { exact: true }).first().click();
  }
  await page.waitForTimeout(900);
  await page.waitForFunction((name) => {
    const roomItems = [...document.querySelectorAll('[data-testid="room-list-item"]')];
    const selected = roomItems.find((item) => {
      const className = item.className?.toString() || "";
      return className.includes("bg-grey600") && !className.includes("border-transparent");
    });
    if (!selected) {
      return false;
    }
    const lines = (selected.innerText || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const first = lines[0] || "";
    const second = lines[1] || "";
    const roomName = first.length <= 3 && second ? second : first;
    return roomName === name;
  }, chatName, { timeout: 2500 }).catch(() => {
    throw new Error(`Keet CDP did not activate expected chat: ${chatName}`);
  });
}

async function readActiveRoomName(page) {
  return await page.evaluate(() => {
    const roomItems = [...document.querySelectorAll('[data-testid="room-list-item"]')].map((item) => ({
      className: item.className?.toString() || "",
      lines: (item.innerText || "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean),
    }));
    const selected = roomItems.find((item) => {
      const className = item.className || "";
      return className.includes("bg-grey600") && !className.includes("border-transparent");
    });
    if (!selected) {
      return undefined;
    }
    const first = selected.lines[0] || "";
    const second = selected.lines[1] || "";
    return first.length <= 3 && second ? second : first;
  });
}

async function verifyActiveRoom(page, target, phase) {
  const activeRoomName = await readActiveRoomName(page);
  assertExpectedActiveRoomName(activeRoomName, target.chat, phase);
}

async function scrollMessagesToBottom(page) {
  await page.evaluate(() => {
    const scrollables = [...document.querySelectorAll("*")].filter((el) => {
      const style = getComputedStyle(el);
      return (style.overflowY === "auto" || style.overflowY === "scroll") && el.scrollHeight > el.clientHeight;
    });
    for (const el of scrollables) {
      el.scrollTop = el.scrollHeight;
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(500);
}

async function readActiveRows(page, target) {
  await scrollMessagesToBottom(page);
  const rows = await page.evaluate(() => {
    let lastIncomingSender = "";
    return [...document.querySelectorAll(".chat-message")]
      .map((el) => {
        const id = el.id || "";
        const textParts = [...el.querySelectorAll(".chat-message__text")].map((node) => ({
          text: (node.innerText || "").trim(),
          isReplyQuote: Boolean(node.closest("blockquote.reply-to-root")),
        }));
        let sender = (el.querySelector(".chat-event-message__other-member-name")?.innerText || "").trim();
        const row = el.closest(".tw-1in0x60");
        const rowClass = row?.className?.toString() || "";
        const direction = rowClass.includes("!flex-row-reverse") ? "outgoing" : "incoming";
        if (direction === "incoming") {
          if (!sender) sender = lastIncomingSender;
          if (sender) {
            lastIncomingSender = sender;
          }
        }
        if (!id || textParts.length === 0) {
          return null;
        }
        return { id, textParts, sender, direction };
      })
      .filter(Boolean);
  }, target);
  return rows
    .map((row) => ({
      ...row,
      text: extractMessageBodyText(row.textParts),
      textParts: undefined,
    }))
    .filter((row) => row.id && row.text);
}

function cssId(id) {
  return String(id).replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}

export function isReplyMenuItemLabel(text) {
  return String(text || "").trim() === "Reply";
}

export function assertReplyTargetSelected(replyToId, selectedReplyTarget) {
  if (replyToId && !selectedReplyTarget) {
    throw new Error(
      `Keet CDP could not select native reply target ${replyToId}; refusing to send a normal message`,
    );
  }
}

async function maybeSelectReplyTarget(page, replyToId) {
  if (!replyToId) {
    return false;
  }
  const row = page.locator(`#${cssId(replyToId)}`).first();
  if (await row.count() === 0) {
    return false;
  }
  await row.hover();
  const selectors = [
    '[data-testid="message-reply"]',
    '[data-testid="message-reply-button"]',
    '[aria-label="Reply"]',
    '[aria-label*="Reply"]',
    '[title="Reply"]',
    '[title*="Reply"]',
  ];
  for (const selector of selectors) {
    const button = page.locator(selector).last();
    if (await button.count() === 0) {
      continue;
    }
    try {
      await button.click({ timeout: 800 });
      await page.waitForTimeout(300);
      return true;
    } catch {}
  }
  const messageMenu = row.locator(".chat-message-menu").first();
  if (await messageMenu.count() > 0) {
    try {
      await messageMenu.click({ timeout: 800, force: true });
      await page.waitForTimeout(300);
      const replyItems = page.locator("ul.chat-message-actions__menu li");
      const replyItemCount = await replyItems.count();
      for (let index = 0; index < replyItemCount; index += 1) {
        const replyItem = replyItems.nth(index);
        const label = await replyItem.innerText({ timeout: 800 }).catch(() => "");
        if (isReplyMenuItemLabel(label)) {
          await replyItem.click({ timeout: 800 });
          await page.waitForTimeout(300);
          return true;
        }
      }
    } catch {}
  }
  return false;
}

async function sendText(page, target, text, replyToId) {
  await verifyActiveRoom(page, target, "before reply selection");
  const selectedReplyTarget = await maybeSelectReplyTarget(page, replyToId);
  assertReplyTargetSelected(replyToId, selectedReplyTarget);
  await verifyActiveRoom(page, target, "before composer");
  const editor = page.locator('[contenteditable="true"][role="textbox"]').last();
  await editor.click();
  await editor.fill(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  await verifyActiveRoom(page, target, "after send");
  const rows = await readActiveRows(page, target);
  const sent = [...rows].reverse().find((row) => row.direction === "outgoing" && row.text.includes(text.slice(0, 80)));
  if (!sent?.id) {
    throw new Error("Keet CDP send did not return latest outgoing message id");
  }
  return { ...sent, replyToId: selectedReplyTarget ? replyToId : undefined };
}

async function runSend(args) {
  const config = await loadBridgeConfig(args.config || DEFAULT_CONFIG_PATH);
  const target = resolveChatTarget(config, args.chat);
  const text = requireString(args.text, "--text");
  const replyToId = readString(args["reply-to"]);
  const sent = await withKeetPage(args.cdp || DEFAULT_CDP_URL, async (page) => {
    await openChat(page, target.chat);
    return await sendText(page, target, text, replyToId);
  });
  return {
    ok: true,
    send: {
      latestOutgoing: {
        id: sent.id,
        chat: target.conversationId,
        ...(sent.replyToId ? { replyToId: sent.replyToId } : {}),
      },
    },
  };
}

async function runPoll(args) {
  requireString(args.account, "--account");
  const config = await loadBridgeConfig(args.config || DEFAULT_CONFIG_PATH);
  const targets = args.chat
    ? [resolveChatTarget(config, args.chat)]
    : enabledTargets(config);
  if (targets.length === 0) {
    throw new Error("No enabled Keet bridge targets configured");
  }
  const limit = Number.parseInt(args.limit ?? "50", 10);
  const events = [];
  await withKeetPage(args.cdp || DEFAULT_CDP_URL, async (page) => {
    for (const target of targets) {
      await openChat(page, target.chat);
      const rows = await readActiveRows(page, target);
      for (const row of rows) {
        const event = eventFromRow(row, { target, aliases: config.senderAliases });
        if (event) {
          events.push(event);
        }
      }
    }
  });
  return buildPollPayload(events, { limit });
}

export async function runCli(argv) {
  const args = parseArgs(argv);
  if (args.action === "send") {
    return runSend(args);
  }
  if (args.action === "poll") {
    return runPoll(args);
  }
  throw new Error(`unsupported action ${args.action || ""}`.trim());
}

async function main() {
  const payload = await runCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
