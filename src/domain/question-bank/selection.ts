import {
  QuestionSelectionDiagnostics,
  QuestionSelectionItem,
  QuestionSelectionResult,
} from './types';

// Simple 32-bit hash for string seed
const hashSeed = (seed: string | number): number => {
  if (typeof seed === 'number') {
    return Math.floor(seed) >>> 0;
  }
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
};

// Mulberry32 32-bit PRNG
export const createPrng = (seedValue: string | number) => {
  let a = hashSeed(seedValue);
  return (): number => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const deterministicShuffle = <T>(
  items: readonly T[],
  seed?: string | number | null
): T[] => {
  const result = [...items];
  if (items.length <= 1) return result;

  const prng = seed !== undefined && seed !== null ? createPrng(seed) : Math.random;

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
};

export const evaluateSelectionPool = (
  eligibleItems: readonly QuestionSelectionItem[],
  requestedCount: number,
  seed?: string | number | null
): QuestionSelectionResult => {
  const poolSize = eligibleItems.length;
  const effectiveSeed = seed ?? null;
  const shuffled = deterministicShuffle(eligibleItems, effectiveSeed);
  const selected = shuffled.slice(0, requestedCount);
  const selectedCount = selected.length;
  const isPoolSufficient = selectedCount >= requestedCount;

  const diagnostics: QuestionSelectionDiagnostics = {
    availableCount: poolSize,
    poolSize,
    requestedCount,
    selectedCount,
    seed: effectiveSeed,
    isPoolSufficient,
    insufficientReason: isPoolSufficient
      ? null
      : `Chỉ có ${poolSize} câu hỏi hợp lệ trong ngân hàng câu hỏi đáp ứng tiêu chí (yêu cầu ${requestedCount})`,
  };

  return {
    selected,
    diagnostics,
  };
};
