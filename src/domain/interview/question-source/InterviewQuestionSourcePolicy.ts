import { sha256Hex } from '../../question-bank/hashing';
import { InterviewQuestionSourceMode } from './types';

export interface SourcePolicyConfig {
  enabled?: boolean;
  mode?: InterviewQuestionSourceMode | string;
  policyVersion?: string;
  count?: number;
  hybridBankCount?: number;
  rolloutPercent?: number;
  rolloutSalt?: string;
}

export const VALID_SOURCE_MODES: ReadonlySet<string> = new Set([
  'AI_ONLY',
  'SHADOW',
  'BANK_ONLY',
  'HYBRID',
]);

export interface RolloutDecision {
  effectiveMode: InterviewQuestionSourceMode;
  configuredMode: InterviewQuestionSourceMode;
  rolloutPercent: number;
  bucket: number;
  isCohortSelected: boolean;
}

export const computeRolloutBucket = (
  sessionId: string,
  policyVersion: string = 'v1',
  salt: string = 'qb-rollout-salt'
): number => {
  const hash = sha256Hex(`${sessionId}:${policyVersion}:${salt}`);
  const intVal = parseInt(hash.slice(0, 8), 16);
  return intVal % 100;
};

export const resolveRolloutDecision = (
  config: SourcePolicyConfig,
  sessionId?: string
): RolloutDecision => {
  const configuredMode = (
    config.mode && VALID_SOURCE_MODES.has(config.mode)
      ? config.mode
      : 'AI_ONLY'
  ) as InterviewQuestionSourceMode;

  const rawPercent = config.rolloutPercent;
  const rolloutPercent =
    rawPercent !== undefined
      ? Math.max(0, Math.min(100, Math.floor(rawPercent)))
      : 100;
  const policyVersion = config.policyVersion || 'v1';
  const salt = config.rolloutSalt || 'qb-rollout-salt';

  if (!config.enabled) {
    return {
      effectiveMode: 'AI_ONLY',
      configuredMode,
      rolloutPercent,
      bucket: sessionId ? computeRolloutBucket(sessionId, policyVersion, salt) : 0,
      isCohortSelected: false,
    };
  }

  if (configuredMode === 'AI_ONLY') {
    return {
      effectiveMode: 'AI_ONLY',
      configuredMode: 'AI_ONLY',
      rolloutPercent,
      bucket: sessionId ? computeRolloutBucket(sessionId, policyVersion, salt) : 0,
      isCohortSelected: true,
    };
  }

  if (rolloutPercent === 0) {
    return {
      effectiveMode: 'AI_ONLY',
      configuredMode,
      rolloutPercent: 0,
      bucket: sessionId ? computeRolloutBucket(sessionId, policyVersion, salt) : 0,
      isCohortSelected: false,
    };
  }

  if (rolloutPercent === 100) {
    return {
      effectiveMode: configuredMode,
      configuredMode,
      rolloutPercent: 100,
      bucket: sessionId ? computeRolloutBucket(sessionId, policyVersion, salt) : 0,
      isCohortSelected: true,
    };
  }

  if (!sessionId) {
    return {
      effectiveMode: 'AI_ONLY',
      configuredMode,
      rolloutPercent,
      bucket: 0,
      isCohortSelected: false,
    };
  }

  const bucket = computeRolloutBucket(sessionId, policyVersion, salt);
  const isCohortSelected = bucket < rolloutPercent;
  const effectiveMode = isCohortSelected ? configuredMode : 'AI_ONLY';

  return {
    effectiveMode,
    configuredMode,
    rolloutPercent,
    bucket,
    isCohortSelected,
  };
};

export const resolveEffectiveSourceMode = (
  config: SourcePolicyConfig,
  sessionId?: string
): InterviewQuestionSourceMode => {
  return resolveRolloutDecision(config, sessionId).effectiveMode;
};

export const computeNormalizedTaxonomyKey = (taxonomy: {
  roleId?: string;
  levelId?: string;
  techIds?: string[];
}): string => {
  const role = taxonomy.roleId?.trim().toLowerCase() ?? '';
  const level = taxonomy.levelId?.trim().toLowerCase() ?? '';
  const techs = (taxonomy.techIds ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(',');
  return `${role}|${level}|${techs}`;
};

export const computeSeedFingerprint = (
  sessionId: string,
  taxonomy: { roleId?: string; levelId?: string; techIds?: string[] },
  policyVersion: string = 'v1'
): string => {
  const taxKey = computeNormalizedTaxonomyKey(taxonomy);
  return sha256Hex(`${sessionId}:${policyVersion}:${taxKey}`);
};

export const computeDeterministicSeed = (
  sessionId: string,
  taxonomy: { roleId?: string; levelId?: string; techIds?: string[] },
  policyVersion: string = 'v1'
): string => {
  return computeSeedFingerprint(sessionId, taxonomy, policyVersion);
};

export interface DifficultyDistribution {
  EASY: number;
  MEDIUM: number;
  HARD: number;
}

export const getDifficultyDistribution = (): DifficultyDistribution => {
  return {
    EASY: 1,
    MEDIUM: 2,
    HARD: 2,
  };
};

export interface HybridTargetDistribution {
  bank: DifficultyDistribution;
  ai: DifficultyDistribution;
}

export const getHybridTargetDistribution = (
  bankCount: number = 2
): HybridTargetDistribution => {
  const boundedBankCount = Math.max(1, Math.min(bankCount, 4));

  // Bank allocation target based on count:
  // 1 -> 1 Medium
  // 2 -> 1 Easy, 1 Medium
  // 3 -> 1 Easy, 1 Medium, 1 Hard
  // 4 -> 1 Easy, 2 Medium, 1 Hard
  let bank: DifficultyDistribution;
  switch (boundedBankCount) {
    case 1:
      bank = { EASY: 0, MEDIUM: 1, HARD: 0 };
      break;
    case 2:
      bank = { EASY: 1, MEDIUM: 1, HARD: 0 };
      break;
    case 3:
      bank = { EASY: 1, MEDIUM: 1, HARD: 1 };
      break;
    case 4:
      bank = { EASY: 1, MEDIUM: 2, HARD: 1 };
      break;
    default:
      bank = { EASY: 1, MEDIUM: 1, HARD: 0 };
      break;
  }

  const overall = getDifficultyDistribution();
  const ai: DifficultyDistribution = {
    EASY: overall.EASY - bank.EASY,
    MEDIUM: overall.MEDIUM - bank.MEDIUM,
    HARD: overall.HARD - bank.HARD,
  };

  return { bank, ai };
};
