/** Small deterministic PRNG so seed output is reproducible (mulberry32). */
export type Rng = {
  next(): number;
  float(min: number, max: number): number;
  int(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  gaussian(mean?: number, sd?: number): number;
  hex(length: number): string;
  uuid(): string;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const hex = (length: number): string => {
    let out = "";
    for (let i = 0; i < length; i++) out += Math.floor(next() * 16).toString(16);
    return out;
  };

  return {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error("pick() called with an empty array");
      return item;
    },
    gaussian: (mean = 0, sd = 1) => {
      const u = Math.max(next(), 1e-9);
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    hex,
    uuid: () => `${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}`,
  };
}

/** Derive a stable per-stream seed from a string, so generators don't share sequences. */
export function seedFrom(label: string): number {
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
