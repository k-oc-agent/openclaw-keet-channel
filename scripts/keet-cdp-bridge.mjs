#!/usr/bin/env node

const DEFAULT_CDP_URL = process.env.KEET_CDP_URL || "http://127.0.0.1:9223";

export const supportedActions = ["send", "poll"];

function parseArgs(argv) {
  const [action, ...rest] = argv;
  const args = { action };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = rest[i + 1];
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

export function isOpenClawEchoText(text) {
  return typeof text === "string" && text.startsWith("K OpenClaw\n");
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
  return {
    id: row.id,
    chatType: target.chatType,
    chat: target.conversationId,
    sender: aliases[sender] ?? sender,
    text,
    timestampMs: Number.isFinite(row.timestampMs) ? row.timestampMs : 0,
  };
}

export function selectVisibleEvents(events, { limit }) {
  const boundedLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 50, 100));
  return events.slice(Math.max(0, events.length - boundedLimit));
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
  await page.getByText(chatName, { exact: true }).first().click();
  await page.waitForTimeout(900);
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
  return await page.evaluate(() => {
    let lastIncomingSender = "";
    return [...document.querySelectorAll(".chat-message")]
      .map((el) => {
        const id = el.id || "";
        const text = (el.querySelector(".chat-message__text")?.innerText || "").trim();
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
        if (!id || !text) {
          return null;
        }
        return { id, text, sender, direction };
      })
      .filter(Boolean);
  }, target);
}

async function sendText(page, text) {
  const editor = page.locator('[contenteditable="true"][role="textbox"]').last();
  await editor.click();
  await editor.fill(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  const rows = await readActiveRows(page);
  const sent = [...rows].reverse().find((row) => row.direction === "outgoing" && row.text.includes(text.slice(0, 80)));
  if (!sent?.id) {
    throw new Error("Keet CDP send did not return latest outgoing message id");
  }
  return sent;
}

async function runSend(args) {
  const chat = requireString(args.chat, "--chat");
  const text = requireString(args.text, "--text");
  const sent = await withKeetPage(args.cdp || DEFAULT_CDP_URL, async (page) => {
    await openChat(page, chat);
    return await sendText(page, text);
  });
  return {
    ok: true,
    send: {
      latestOutgoing: {
        id: sent.id,
        chat,
      },
    },
  };
}

async function runPoll(args) {
  requireString(args.account, "--account");
  const chat = requireString(args.chat, "--chat");
  const target = targetFromChat(chat);
  const limit = Number.parseInt(args.limit ?? "50", 10);
  const rows = await withKeetPage(args.cdp || DEFAULT_CDP_URL, async (page) => {
    await openChat(page, chat);
    return await readActiveRows(page, target);
  });
  const aliases = { Plak: "plak0815" };
  const events = rows
    .map((row) => eventFromRow(row, { target, aliases }))
    .filter(Boolean);
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
