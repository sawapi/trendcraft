/**
 * Alpaca REST client for paper trading
 *
 * Handles account info, order placement, and position queries.
 * Uses native fetch — no external SDK dependency.
 */

import type { AlpacaEnv } from "../config/env.js";

// ============================================
// Types
// ============================================

export type AlpacaAccount = {
  id: string;
  status: string;
  currency: string;
  cash: string;
  portfolio_value: string;
  buying_power: string;
  equity: string;
};

export type AlpacaPosition = {
  asset_id: string;
  symbol: string;
  qty: string;
  side: "long" | "short";
  avg_entry_price: string;
  market_value: string;
  unrealized_pl: string;
  current_price: string;
};

export type AlpacaOrderSide = "buy" | "sell";
export type AlpacaOrderType = "market" | "limit";
export type AlpacaTimeInForce = "day" | "gtc" | "ioc";

export type AlpacaOrderRequest = {
  symbol: string;
  qty: number;
  side: AlpacaOrderSide;
  type: AlpacaOrderType;
  time_in_force: AlpacaTimeInForce;
  limit_price?: number;
};

export type AlpacaOrder = {
  id: string;
  client_order_id: string;
  symbol: string;
  qty: string;
  filled_qty: string;
  side: string;
  type: string;
  status: string;
  filled_avg_price: string | null;
  created_at: string;
  filled_at: string | null;
};

// ============================================
// Client
// ============================================

export type AlpacaClient = {
  getAccount(): Promise<AlpacaAccount>;
  getPositions(): Promise<AlpacaPosition[]>;
  getPosition(symbol: string): Promise<AlpacaPosition | null>;
  submitOrder(order: AlpacaOrderRequest): Promise<AlpacaOrder>;
  getOrder(orderId: string): Promise<AlpacaOrder>;
  cancelOrder(orderId: string): Promise<void>;
  closePosition(symbol: string): Promise<AlpacaOrder>;
  closeAllPositions(): Promise<void>;
};

export function createAlpacaClient(env: AlpacaEnv): AlpacaClient {
  const headers = {
    "APCA-API-KEY-ID": env.apiKey,
    "APCA-API-SECRET-KEY": env.apiSecret,
    "Content-Type": "application/json",
  };

  async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const url = `${env.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Alpaca API error ${res.status}: ${text}`);
    }

    // DELETE responses may have no body
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  return {
    getAccount() {
      return request<AlpacaAccount>("/v2/account");
    },

    getPositions() {
      return request<AlpacaPosition[]>("/v2/positions");
    },

    async getPosition(symbol: string) {
      try {
        return await request<AlpacaPosition>(`/v2/positions/${symbol}`);
      } catch {
        return null;
      }
    },

    submitOrder(order: AlpacaOrderRequest) {
      return request<AlpacaOrder>("/v2/orders", "POST", order);
    },

    getOrder(orderId: string) {
      return request<AlpacaOrder>(`/v2/orders/${orderId}`);
    },

    async cancelOrder(orderId: string) {
      await request<void>(`/v2/orders/${orderId}`, "DELETE");
    },

    closePosition(symbol: string) {
      return request<AlpacaOrder>(`/v2/positions/${symbol}`, "DELETE");
    },

    async closeAllPositions() {
      await request<void>("/v2/positions", "DELETE");
    },
  };
}
