/**
 * Deterministic pseudo-random number generation.
 *
 * A seeded uniform RNG is a foundational numeric primitive (reproducible Monte
 * Carlo, bootstrap resampling, model initialization), so it lives in `core`
 * with a single owner rather than being re-implemented per consumer. The HMM /
 * CandleFormer ML code, the optimization Monte Carlo and the analysis event
 * study all draw from here.
 */

/**
 * Mulberry32 PRNG — a fast, deterministic generator. Returns a function that
 * produces values in `[0, 1)`; the same seed always yields the same sequence.
 *
 * @param seed - Integer seed
 * @returns A function returning the next value in `[0, 1)`
 */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw a standard-normal sample from a uniform RNG via the Box-Muller
 * transform.
 *
 * @param rng - A uniform `[0, 1)` generator (e.g. from {@link mulberry32})
 * @returns A sample from `N(0, 1)`
 */
export function randNormal(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
}
