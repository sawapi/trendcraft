/**
 * Incremental Channel Line.
 *
 * Wraps `createSwingPoints` and tracks the last 2 confirmed swing highs +
 * the last 2 confirmed swing lows. From those:
 *   - up-channel candidate connects the last two swing lows when rising;
 *     the parallel line passes through the highest swing high between them.
 *   - down-channel candidate connects the last two swing highs when falling;
 *     the parallel line passes through the lowest swing low between them.
 *   - if both candidates are valid, the more recent one (by anchor index)
 *     wins.
 *
 * Output projects the primary line at the current bar (`count - 1`) and the
 * parallel offset is added/subtracted to produce upper/lower/middle.
 *
 * Parity note (same shifted-parity property as Fib Retracement): batch uses
 * look-ahead via batch `swingPoints`, while live confirms swings with
 * `rightBars` delay. Live's `direction` and channel parameters at step `t`
 * agree with `batch[t - rightBars]`. Raw `upper / lower / middle` cannot be
 * compared bar-by-bar across the shift because each side projects at a
 * different bar (live at the current bar, batch at its own iteration index);
 * tests verify direction parity plus standard snapshot / peek / warmup
 * properties.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { cloneShallow, pushBounded, resolveSwingConfig } from "./swing-helpers";
import { type SwingPointsState, createSwingPoints } from "./swing-points";

export type ChannelLineValue = {
  /** Upper channel line value */
  upper: number | null;
  /** Lower channel line value */
  lower: number | null;
  /** Middle channel line value (average of upper and lower) */
  middle: number | null;
  /** Channel direction: "up" or "down" */
  direction: "up" | "down" | null;
};

export type ChannelLineOptions = {
  /** Number of bars to the left for swing point confirmation (default: 10) */
  leftBars?: number;
  /** Number of bars to the right for swing point confirmation (default: 10) */
  rightBars?: number;
};

type SwingPoint = {
  index: number;
  price: number;
};

export type ChannelLineState = {
  leftBars: number;
  rightBars: number;
  swings: SwingPointsState;
  lastTwoHighs: SwingPoint[];
  lastTwoLows: SwingPoint[];
  highsSinceLastSwingLow: SwingPoint[];
  lowsSinceLastSwingHigh: SwingPoint[];
  highsBetweenLastTwoLows: SwingPoint[];
  lowsBetweenLastTwoHighs: SwingPoint[];
  channelDefined: boolean;
  channelDir: "up" | "down";
  primarySlope: number;
  primaryAnchorIdx: number;
  primaryAnchorPrice: number;
  parallelOffset: number;
  count: number;
};

export function createChannelLine(
  options: ChannelLineOptions = {},
  warmUpOptions?: WarmUpOptions<ChannelLineState>,
): IncrementalIndicator<ChannelLineValue, ChannelLineState> {
  const fromState = warmUpOptions?.fromState;
  const { leftBars, rightBars } = resolveSwingConfig(options, fromState);

  let swings: ReturnType<typeof createSwingPoints>;
  let lastTwoHighs: SwingPoint[];
  let lastTwoLows: SwingPoint[];
  let highsSinceLastSwingLow: SwingPoint[];
  let lowsSinceLastSwingHigh: SwingPoint[];
  let highsBetweenLastTwoLows: SwingPoint[];
  let lowsBetweenLastTwoHighs: SwingPoint[];
  let channelDefined: boolean;
  let channelDir: "up" | "down";
  let primarySlope: number;
  let primaryAnchorIdx: number;
  let primaryAnchorPrice: number;
  let parallelOffset: number;
  let count: number;

  if (fromState) {
    swings = createSwingPoints({ leftBars, rightBars }, { fromState: fromState.swings });
    lastTwoHighs = cloneShallow(fromState.lastTwoHighs);
    lastTwoLows = cloneShallow(fromState.lastTwoLows);
    highsSinceLastSwingLow = cloneShallow(fromState.highsSinceLastSwingLow);
    lowsSinceLastSwingHigh = cloneShallow(fromState.lowsSinceLastSwingHigh);
    highsBetweenLastTwoLows = cloneShallow(fromState.highsBetweenLastTwoLows);
    lowsBetweenLastTwoHighs = cloneShallow(fromState.lowsBetweenLastTwoHighs);
    channelDefined = fromState.channelDefined;
    channelDir = fromState.channelDir;
    primarySlope = fromState.primarySlope;
    primaryAnchorIdx = fromState.primaryAnchorIdx;
    primaryAnchorPrice = fromState.primaryAnchorPrice;
    parallelOffset = fromState.parallelOffset;
    count = fromState.count;
  } else {
    swings = createSwingPoints({ leftBars, rightBars });
    lastTwoHighs = [];
    lastTwoLows = [];
    highsSinceLastSwingLow = [];
    lowsSinceLastSwingHigh = [];
    highsBetweenLastTwoLows = [];
    lowsBetweenLastTwoHighs = [];
    channelDefined = false;
    channelDir = "up";
    primarySlope = 0;
    primaryAnchorIdx = 0;
    primaryAnchorPrice = 0;
    parallelOffset = 0;
    count = 0;
  }

  /**
   * Re-evaluate channel candidates from the current `lastTwoLows` /
   * `lastTwoHighs` and the corresponding "between" lists. Mirrors the batch
   * decision: prefer the candidate with the more recent defining point when
   * both are valid.
   */
  function reEvaluateChannel(): void {
    let upValid = false;
    let upSlope = 0;
    let upAnchorIdx = 0;
    let upAnchorPrice = 0;
    let upOffset = 0;
    let upLastIdx = 0;

    if (lastTwoLows.length === 2) {
      const sl1 = lastTwoLows[0];
      const sl2 = lastTwoLows[1];
      if (sl2.price > sl1.price) {
        upValid = true;
        upSlope = (sl2.price - sl1.price) / (sl2.index - sl1.index);
        upAnchorIdx = sl1.index;
        upAnchorPrice = sl1.price;
        upLastIdx = sl2.index;
        let maxOffset = 0;
        for (const sh of highsBetweenLastTwoLows) {
          if (sh.index >= sl1.index && sh.index <= sl2.index) {
            const onPrimary = upAnchorPrice + upSlope * (sh.index - upAnchorIdx);
            const offset = sh.price - onPrimary;
            if (offset > maxOffset) maxOffset = offset;
          }
        }
        upOffset = maxOffset;
      }
    }

    let downValid = false;
    let downSlope = 0;
    let downAnchorIdx = 0;
    let downAnchorPrice = 0;
    let downOffset = 0;
    let downLastIdx = 0;

    if (lastTwoHighs.length === 2) {
      const sh1 = lastTwoHighs[0];
      const sh2 = lastTwoHighs[1];
      if (sh2.price < sh1.price) {
        downValid = true;
        downSlope = (sh2.price - sh1.price) / (sh2.index - sh1.index);
        downAnchorIdx = sh1.index;
        downAnchorPrice = sh1.price;
        downLastIdx = sh2.index;
        let maxOffset = 0;
        for (const sl of lowsBetweenLastTwoHighs) {
          if (sl.index >= sh1.index && sl.index <= sh2.index) {
            const onPrimary = downAnchorPrice + downSlope * (sl.index - downAnchorIdx);
            const offset = onPrimary - sl.price;
            if (offset > maxOffset) maxOffset = offset;
          }
        }
        downOffset = maxOffset;
      }
    }

    if (upValid && downValid) {
      if (upLastIdx >= downLastIdx) {
        channelDir = "up";
        primarySlope = upSlope;
        primaryAnchorIdx = upAnchorIdx;
        primaryAnchorPrice = upAnchorPrice;
        parallelOffset = upOffset;
      } else {
        channelDir = "down";
        primarySlope = downSlope;
        primaryAnchorIdx = downAnchorIdx;
        primaryAnchorPrice = downAnchorPrice;
        parallelOffset = downOffset;
      }
      channelDefined = true;
    } else if (upValid) {
      channelDir = "up";
      primarySlope = upSlope;
      primaryAnchorIdx = upAnchorIdx;
      primaryAnchorPrice = upAnchorPrice;
      parallelOffset = upOffset;
      channelDefined = true;
    } else if (downValid) {
      channelDir = "down";
      primarySlope = downSlope;
      primaryAnchorIdx = downAnchorIdx;
      primaryAnchorPrice = downAnchorPrice;
      parallelOffset = downOffset;
      channelDefined = true;
    }
    // If neither is valid, leave existing state untouched (matches batch:
    // batch only writes channel state inside a valid branch).
  }

  function project(barIdx: number): ChannelLineValue {
    if (!channelDefined || barIdx < primaryAnchorIdx) {
      return { upper: null, lower: null, middle: null, direction: null };
    }
    const primary = primaryAnchorPrice + primarySlope * (barIdx - primaryAnchorIdx);
    const upper = channelDir === "up" ? primary + parallelOffset : primary;
    const lower = channelDir === "up" ? primary : primary - parallelOffset;
    return {
      upper,
      lower,
      middle: (upper + lower) / 2,
      direction: channelDir,
    };
  }

  const indicator: IncrementalIndicator<ChannelLineValue, ChannelLineState> = {
    next(candle: NormalizedCandle) {
      count++;
      const swingResult = swings.next(candle);
      const sv = swingResult.value;
      const confirmedIdx = count - 1 - rightBars;

      let updated = false;

      if (sv.isSwingHigh && sv.swingHighPrice !== null && confirmedIdx >= 0) {
        const point: SwingPoint = { index: confirmedIdx, price: sv.swingHighPrice };
        // Capture lows-since-last-swing-high as the new "between last two
        // highs" set, then reset; finally update lastTwoHighs.
        lowsBetweenLastTwoHighs = lowsSinceLastSwingHigh;
        lowsSinceLastSwingHigh = [];
        pushBounded(lastTwoHighs, point, 2);
        // The new high also belongs to "highs since last swing low".
        highsSinceLastSwingLow.push(point);
        updated = true;
      }

      if (sv.isSwingLow && sv.swingLowPrice !== null && confirmedIdx >= 0) {
        const point: SwingPoint = { index: confirmedIdx, price: sv.swingLowPrice };
        highsBetweenLastTwoLows = highsSinceLastSwingLow;
        highsSinceLastSwingLow = [];
        pushBounded(lastTwoLows, point, 2);
        lowsSinceLastSwingHigh.push(point);
        updated = true;
      }

      if (updated) reEvaluateChannel();

      return {
        time: candle.time,
        value: project(count - 1),
      };
    },

    peek(candle: NormalizedCandle) {
      const saved = indicator.getState();
      const result = indicator.next(candle);
      swings = createSwingPoints({ leftBars, rightBars }, { fromState: saved.swings });
      lastTwoHighs = cloneShallow(saved.lastTwoHighs);
      lastTwoLows = cloneShallow(saved.lastTwoLows);
      highsSinceLastSwingLow = cloneShallow(saved.highsSinceLastSwingLow);
      lowsSinceLastSwingHigh = cloneShallow(saved.lowsSinceLastSwingHigh);
      highsBetweenLastTwoLows = cloneShallow(saved.highsBetweenLastTwoLows);
      lowsBetweenLastTwoHighs = cloneShallow(saved.lowsBetweenLastTwoHighs);
      channelDefined = saved.channelDefined;
      channelDir = saved.channelDir;
      primarySlope = saved.primarySlope;
      primaryAnchorIdx = saved.primaryAnchorIdx;
      primaryAnchorPrice = saved.primaryAnchorPrice;
      parallelOffset = saved.parallelOffset;
      count = saved.count;
      return result;
    },

    getState(): ChannelLineState {
      return {
        leftBars,
        rightBars,
        swings: swings.getState(),
        lastTwoHighs: cloneShallow(lastTwoHighs),
        lastTwoLows: cloneShallow(lastTwoLows),
        highsSinceLastSwingLow: cloneShallow(highsSinceLastSwingLow),
        lowsSinceLastSwingHigh: cloneShallow(lowsSinceLastSwingHigh),
        highsBetweenLastTwoLows: cloneShallow(highsBetweenLastTwoLows),
        lowsBetweenLastTwoHighs: cloneShallow(lowsBetweenLastTwoHighs),
        channelDefined,
        channelDir,
        primarySlope,
        primaryAnchorIdx,
        primaryAnchorPrice,
        parallelOffset,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return swings.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
