/**
 * Alpaca WebSocket data feed adapter
 *
 * Connects to Alpaca's IEX real-time data stream and emits Trade events
 * compatible with TrendCraft's streaming module.
 */

import WebSocket from "ws";
import type { streaming } from "trendcraft";
import type { AlpacaEnv } from "../config/env.js";

export type AlpacaTradeMessage = {
  T: "t"; // trade
  S: string; // symbol
  p: number; // price
  s: number; // size
  t: string; // timestamp
  c: string[]; // conditions
};

export type AlpacaWsMessage =
  | { T: "success"; msg: string }
  | { T: "error"; code: number; msg: string }
  | { T: "subscription"; trades: string[]; quotes: string[]; bars: string[] }
  | AlpacaTradeMessage;

export type TradeHandler = (symbol: string, trade: streaming.Trade) => void;

export type AlpacaWebSocket = {
  subscribe(symbols: string[]): void;
  unsubscribe(symbols: string[]): void;
  close(): void;
  onTrade(handler: TradeHandler): void;
  isConnected(): boolean;
};

export function createAlpacaWebSocket(env: AlpacaEnv): AlpacaWebSocket {
  let ws: WebSocket | null = null;
  let authenticated = false;
  let tradeHandler: TradeHandler | null = null;
  let pendingSubscriptions: string[] = [];
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  function connect(): void {
    if (closed) return;

    ws = new WebSocket(env.streamUrl);

    ws.on("open", () => {
      console.log("[WS] Connected to Alpaca stream");
    });

    ws.on("message", (data: WebSocket.Data) => {
      const messages = JSON.parse(data.toString()) as AlpacaWsMessage[];

      for (const msg of messages) {
        switch (msg.T) {
          case "success":
            if (msg.msg === "connected") {
              // Authenticate
              ws?.send(
                JSON.stringify({
                  action: "auth",
                  key: env.apiKey,
                  secret: env.apiSecret,
                }),
              );
            } else if (msg.msg === "authenticated") {
              authenticated = true;
              console.log("[WS] Authenticated");
              // Subscribe pending symbols
              if (pendingSubscriptions.length > 0) {
                ws?.send(
                  JSON.stringify({
                    action: "subscribe",
                    trades: pendingSubscriptions,
                  }),
                );
                pendingSubscriptions = [];
              }
            }
            break;

          case "error":
            console.error(`[WS] Error ${msg.code}: ${msg.msg}`);
            break;

          case "subscription":
            console.log(`[WS] Subscribed to trades: ${msg.trades.join(", ")}`);
            break;

          case "t":
            if (tradeHandler) {
              tradeHandler(msg.S, {
                time: new Date(msg.t).getTime(),
                price: msg.p,
                volume: msg.s,
              });
            }
            break;
        }
      }
    });

    ws.on("close", () => {
      authenticated = false;
      if (!closed) {
        console.log("[WS] Disconnected, reconnecting in 5s...");
        reconnectTimer = setTimeout(connect, 5000);
      }
    });

    ws.on("error", (err) => {
      console.error("[WS] Error:", err.message);
    });
  }

  connect();

  return {
    subscribe(symbols: string[]) {
      if (authenticated && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "subscribe", trades: symbols }));
      } else {
        pendingSubscriptions.push(...symbols);
      }
    },

    unsubscribe(symbols: string[]) {
      if (authenticated && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "unsubscribe", trades: symbols }));
      }
    },

    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },

    onTrade(handler: TradeHandler) {
      tradeHandler = handler;
    },

    isConnected() {
      return authenticated && ws?.readyState === WebSocket.OPEN;
    },
  };
}
