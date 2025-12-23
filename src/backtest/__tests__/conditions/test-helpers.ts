/**
 * Common test helpers for condition tests
 */

import type { NormalizedCandle } from "../../../types";

/**
 * Generate test candles with sine wave pattern
 */
export function generateCandles(count: number, basePrice = 100): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const price = basePrice + Math.sin(i / 10) * 10 + i * 0.1;
    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000 + Math.random() * 100000,
    });
  }

  return candles;
}

/**
 * Generate uptrend candles for golden cross testing
 */
export function generateUptrendCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // First half: downtrend, second half: strong uptrend
    let price: number;
    if (i < count / 2) {
      price = 100 - i * 0.5; // Downtrend
    } else {
      price = 100 - (count / 2) * 0.5 + (i - count / 2) * 2; // Strong uptrend
    }

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

/**
 * Generate strong uptrend candles
 */
export function generateStrongUptrend(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // Flat first, then strong uptrend
    const price = i < 30 ? 100 : 100 + (i - 30) * 3;
    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000,
    });
  }
  return candles;
}

/**
 * Generate strong downtrend candles
 */
export function generateStrongDowntrend(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // Flat first, then strong downtrend
    const price = i < 30 ? 200 : 200 - (i - 30) * 3;
    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price + 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000,
    });
  }
  return candles;
}

/**
 * Generate trend reversal candles
 */
export function generateTrendReversal(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    let price: number;
    if (i < 80) {
      price = 100 + i * 2; // Long strong uptrend to establish perfect order
    } else {
      price = 260 - (i - 80) * 2; // Reversal
    }
    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000,
    });
  }
  return candles;
}

/**
 * Generate sustained uptrend candles
 */
export function generateSustainedUptrend(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const price = 100 + i * 1.5;
    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000,
    });
  }
  return candles;
}
