/**
 * Webhook notification dispatcher
 *
 * Sends trading events to external webhook endpoints (Discord, Slack, custom).
 * Fire-and-forget — failures are logged but never block trading.
 *
 * @example
 * ```ts
 * const notifier = createWebhookNotifier({
 *   url: "https://discord.com/api/webhooks/...",
 *   events: ["trade-executed", "error", "session-started"],
 * });
 * session.onEvent(notifier);
 * ```
 */

import type { TradingEvent } from "../trading/events.js";
import { createLogger } from "../util/logger.js";

const log = createLogger("WEBHOOK");

export type WebhookConfig = {
  /** Webhook URL (Discord, Slack incoming webhook, or any HTTP endpoint) */
  url: string;
  /** Only send events of these types. If omitted, sends all events. */
  events?: string[];
  /** Minimum interval between same-type events in ms (default: 5000) */
  rateLimit?: number;
};

type WebhookPayload = {
  timestamp: string;
  event: string;
  data: Record<string, unknown>;
};

/**
 * Create a webhook notifier function that can be passed to session.onEvent().
 */
export function createWebhookNotifier(config: WebhookConfig): (event: TradingEvent) => void {
  const rateLimit = config.rateLimit ?? 5000;
  const lastSent = new Map<string, number>();
  const allowedEvents = config.events ? new Set(config.events) : null;

  return (event: TradingEvent) => {
    // Event filter
    if (allowedEvents && !allowedEvents.has(event.type)) return;

    // Rate limit per event type
    const now = Date.now();
    const lastTime = lastSent.get(event.type) ?? 0;
    if (now - lastTime < rateLimit) return;
    lastSent.set(event.type, now);

    const payload = buildPayload(event);
    sendWebhook(config.url, payload);
  };
}

function buildPayload(event: TradingEvent): WebhookPayload {
  const { type, ...data } = event;
  return {
    timestamp: new Date().toISOString(),
    event: type,
    data: data as Record<string, unknown>,
  };
}

function sendWebhook(url: string, payload: WebhookPayload): void {
  // Detect Discord webhook and wrap in Discord message format
  const body = url.includes("discord.com/api/webhooks")
    ? JSON.stringify({ content: formatDiscordMessage(payload) })
    : JSON.stringify(payload);

  // Fire-and-forget
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => {
    log.warn(`Failed to send webhook: ${err instanceof Error ? err.message : err}`);
  });
}

/**
 * Format a payload as a human-readable Discord message.
 */
function formatDiscordMessage(payload: WebhookPayload): string {
  const { event, data, timestamp } = payload;
  const time = new Date(timestamp).toLocaleTimeString("en-US", { hour12: false });

  switch (event) {
    case "trade-executed":
      return `**${(data.side as string).toUpperCase()}** ${data.shares} shares of **${data.symbol}** (${data.agentId}) — ${data.reason}${data.pnl != null ? ` | P&L: $${(data.pnl as number).toFixed(2)}` : ""} [${time}]`;
    case "trade-blocked":
      return `Blocked: ${data.agentId} ${data.symbol} — ${data.reason} [${time}]`;
    case "error":
      return `**Error** [${data.source}]: ${data.message} [${time}]`;
    case "session-started":
      return (
        `**Session started** (${data.mode}) — ${data.agentCount} agents, ` +
        `symbols: ${(data.symbols as string[]).join(", ")} [${time}]`
      );
    case "session-stopped":
      return `**Session stopped** [${time}]`;
    case "review-completed":
      return (
        `**Review completed** (${data.reviewType}) — ` +
        `${data.appliedCount} applied, ${data.rejectedCount} rejected [${time}]`
      );
    case "reconciliation":
      return (
        `**Reconciliation** — ${data.discrepancies} discrepancies, ` +
        `${data.orphaned} orphaned [${time}]`
      );
    default:
      return `[${event}] ${JSON.stringify(data)} [${time}]`;
  }
}
