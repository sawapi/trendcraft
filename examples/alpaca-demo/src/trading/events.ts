/**
 * Trading event types for TUI and session communication
 */

export type TradingEvent =
  | { type: "agent-created"; agentId: string; symbol: string; strategyId: string }
  | {
      type: "trade-executed";
      agentId: string;
      symbol: string;
      side: "buy" | "sell";
      shares: number;
      reason: string;
      pnl?: number;
    }
  | { type: "trade-blocked"; agentId: string; symbol: string; reason: string }
  | { type: "state-saved"; agentCount: number }
  | { type: "leaderboard-updated" }
  | { type: "reconciliation"; discrepancies: number; orphaned: number }
  | { type: "review-started"; reviewType: "daily" | "intra-session"; reviewNumber?: number }
  | {
      type: "review-completed";
      reviewType: "daily" | "intra-session";
      appliedCount: number;
      rejectedCount: number;
    }
  | { type: "error"; message: string; source: string }
  | { type: "session-started"; mode: string; agentCount: number; symbols: string[] }
  | { type: "session-stopped" }
  | { type: "websocket-connected" }
  | { type: "websocket-disconnected" };
