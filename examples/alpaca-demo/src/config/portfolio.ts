/**
 * Default PortfolioGuard configuration
 */

import type { streaming } from "trendcraft";

export const DEFAULT_PORTFOLIO_GUARD: streaming.PortfolioGuardOptions = {
  maxTotalExposure: 150,
  maxSymbolExposure: 30,
  maxOpenPositions: 8,
  maxPortfolioDrawdown: 10,
};

/** Maximum positions per sector for correlation guard */
export const DEFAULT_MAX_SECTOR_POSITIONS = 2;
