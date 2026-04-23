/**
 * ICT Kill Zones
 *
 * Identifies whether a candle falls within a standard ICT Kill Zone,
 * providing zone name and characteristic behavior description.
 *
 * Kill Zones are specific time windows where institutional activity
 * is expected to be highest, leading to predictable price behavior.
 *
 * Note: All times are in UTC. DST is ignored (fixed UTC-5 offset).
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { isInSession } from "./session-definition";
import { getTzHourMinute } from "./tz-utils";

/**
 * Definition of a kill zone with expected behavior
 */
export type KillZoneDefinition = {
  /** Kill zone name */
  name: string;
  /** Start hour in UTC (0-23) */
  startHour: number;
  /** Start minute (0-59) */
  startMinute: number;
  /** End hour in UTC (0-23) */
  endHour: number;
  /** End minute (0-59) */
  endMinute: number;
  /** Expected behavior in this zone */
  characteristic: string;
  /** Optional IANA timezone (default: "UTC") */
  timezone?: string;
};

/**
 * Kill zone status for a single bar
 */
export type KillZoneValue = {
  /** Kill zone name (null if not in a kill zone) */
  zone: string | null;
  /** Whether currently in a kill zone */
  inKillZone: boolean;
  /** Characteristic of the current zone */
  characteristic: string | null;
};

/**
 * Returns the standard ICT Kill Zones in UTC (converted from ET, UTC-5).
 *
 * - Asian KZ: 00:00-05:00 UTC — Range formation, accumulation
 * - London Open KZ: 07:00-09:00 UTC — Fakeouts, stop hunts, initial move
 * - NY Open KZ: 12:00-14:00 UTC — Maximum liquidity, strongest moves
 * - London Close KZ: 15:00-17:00 UTC — Reversals, profit taking
 *
 * Note: DST is ignored; times use fixed UTC-5 offset.
 *
 * @returns Array of ICT kill zone definitions
 *
 * @example
 * ```ts
 * const zones = getIctKillZones();
 * // [{ name: "Asian KZ", startHour: 0, ..., characteristic: "Range formation, accumulation" }, ...]
 * ```
 */
export function getIctKillZones(): KillZoneDefinition[] {
  return [
    {
      name: "Asian KZ",
      startHour: 0,
      startMinute: 0,
      endHour: 5,
      endMinute: 0,
      characteristic: "Range formation, accumulation",
    },
    {
      name: "London Open KZ",
      startHour: 7,
      startMinute: 0,
      endHour: 9,
      endMinute: 0,
      characteristic: "Fakeouts, stop hunts, initial move",
    },
    {
      name: "NY Open KZ",
      startHour: 12,
      startMinute: 0,
      endHour: 14,
      endMinute: 0,
      characteristic: "Maximum liquidity, strongest moves",
    },
    {
      name: "London Close KZ",
      startHour: 15,
      startMinute: 0,
      endHour: 17,
      endMinute: 0,
      characteristic: "Reversals, profit taking",
    },
  ];
}

/**
 * Detect whether each candle falls within an ICT Kill Zone.
 *
 * For each candle, checks its UTC time against all defined kill zones.
 * Returns the first matching zone (zones should not overlap in standard ICT definitions).
 *
 * @param candles - Array of candles (raw or normalized)
 * @param zones - Kill zone definitions (default: ICT kill zones)
 * @returns Series of KillZoneValue
 *
 * @example
 * ```ts
 * import { killZones, getIctKillZones } from "trendcraft";
 *
 * const kzSeries = killZones(candles);
 * kzSeries.forEach(({ value }) => {
 *   if (value.inKillZone) {
 *     console.log(`In ${value.zone}: ${value.characteristic}`);
 *   }
 * });
 * ```
 */
export function killZones(
  candles: Candle[] | NormalizedCandle[],
  zones?: KillZoneDefinition[],
): Series<KillZoneValue> {
  if (candles.length === 0) return [];

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const zoneDefs = zones ?? getIctKillZones();
  const result: Series<KillZoneValue> = [];

  for (const candle of normalized) {
    let matched: KillZoneDefinition | null = null;
    for (const zone of zoneDefs) {
      const { hour, minute } = getTzHourMinute(candle.time, zone.timezone);
      if (isInSession(hour, minute, zone)) {
        matched = zone;
        break;
      }
    }

    result.push({
      time: candle.time,
      value: {
        zone: matched?.name ?? null,
        inKillZone: matched !== null,
        characteristic: matched?.characteristic ?? null,
      },
    });
  }

  return result;
}
