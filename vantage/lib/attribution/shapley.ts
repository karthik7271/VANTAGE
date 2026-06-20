/**
 * Shapley-value attribution engine — TypeScript port of shapley.py.
 *
 * Runs in-process inside the Next.js cron route so attribution can be
 * recomputed on a schedule (see app/api/cron/recompute-attribution) without
 * a separate Python process. Exact subset enumeration is O(n * 2^(n-1)),
 * which is trivial at 5 channels but stops being viable once a real ad
 * integration (Meta, Google Ads, LinkedIn, ...) pushes the channel count
 * past a dozen or so. Past EXACT_CHANNEL_LIMIT we fall back to Monte Carlo
 * permutation sampling, which converges to the same value with bounded
 * compute regardless of channel count.
 */

export interface Journey {
  channels: string[];
  revenue: number;
}

const EXACT_CHANNEL_LIMIT = 12;
const MONTE_CARLO_SAMPLES = 20_000;

function characteristicFunction(journeys: Journey[], coalition: Set<string>): number {
  let total = 0;
  for (const journey of journeys) {
    if (journey.channels.some((ch) => coalition.has(ch))) {
      total += journey.revenue;
    }
  }
  return total;
}

function factorials(n: number): number[] {
  const f = [1];
  for (let i = 1; i <= n; i++) f.push(f[i - 1] * i);
  return f;
}

// All subsets of `items`, as Set<string>, including the empty set.
function* subsets(items: string[]): Generator<Set<string>> {
  const n = items.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    const s = new Set<string>();
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) s.add(items[i]);
    }
    yield s;
  }
}

function computeShapleyExact(
  channels: string[],
  journeys: Journey[],
): Record<string, number> {
  const n = channels.length;
  const fact = factorials(n);
  const result: Record<string, number> = {};

  for (const channel of channels) {
    const others = channels.filter((c) => c !== channel);
    let phi = 0;
    for (const subset of subsets(others)) {
      const size = subset.size;
      const withChannel = new Set(subset);
      withChannel.add(channel);
      const weight = (fact[size] * fact[n - size - 1]) / fact[n];
      const marginal =
        characteristicFunction(journeys, withChannel) -
        characteristicFunction(journeys, subset);
      phi += weight * marginal;
    }
    result[channel] = phi;
  }
  return result;
}

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Monte Carlo approximation: average marginal contribution of each channel
// across random permutations of the full channel set. Converges to the
// exact Shapley value as samples -> infinity (law of large numbers over the
// same marginal-contribution definition exact enumeration uses).
function computeShapleyMonteCarlo(
  channels: string[],
  journeys: Journey[],
  samples = MONTE_CARLO_SAMPLES,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const ch of channels) totals[ch] = 0;

  for (let s = 0; s < samples; s++) {
    const order = shuffled(channels);
    const coalition = new Set<string>();
    let prevValue = 0;
    for (const channel of order) {
      coalition.add(channel);
      const value = characteristicFunction(journeys, coalition);
      totals[channel] += value - prevValue;
      prevValue = value;
    }
  }

  const result: Record<string, number> = {};
  for (const ch of channels) result[ch] = totals[ch] / samples;
  return result;
}

export function computeShapley(
  channels: string[],
  journeys: Journey[],
): { values: Record<string, number>; method: "exact" | "monte_carlo" } {
  if (channels.length <= EXACT_CHANNEL_LIMIT) {
    return { values: computeShapleyExact(channels, journeys), method: "exact" };
  }
  return {
    values: computeShapleyMonteCarlo(channels, journeys),
    method: "monte_carlo",
  };
}

export function lastTouchAttribution(journeys: Journey[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const journey of journeys) {
    if (journey.channels.length === 0) continue;
    const last = journey.channels[journey.channels.length - 1];
    result[last] = (result[last] ?? 0) + journey.revenue;
  }
  return result;
}

export function linearAttribution(journeys: Journey[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const journey of journeys) {
    if (journey.channels.length === 0) continue;
    const share = journey.revenue / journey.channels.length;
    for (const ch of journey.channels) {
      result[ch] = (result[ch] ?? 0) + share;
    }
  }
  return result;
}
