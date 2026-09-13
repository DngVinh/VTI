import { LocalizedContent, AiUsageMetadata } from '../types';

export type InterviewQuestionSourceMode = 'AI_ONLY' | 'SHADOW' | 'BANK_ONLY' | 'HYBRID';
export type InterviewQuestionSourceType = 'AI_GENERATED' | 'QUESTION_BANK';

export const INTERVIEW_SOURCE_ERROR_CODES = {
  SOURCE_UNAVAILABLE: 'INTERVIEW_QUESTION_SOURCE_UNAVAILABLE',
  BANK_DISABLED: 'INTERVIEW_QUESTION_BANK_DISABLED',
  POOL_INSUFFICIENT: 'INTERVIEW_QUESTION_BANK_POOL_INSUFFICIENT',
  BUNDLE_INVALID: 'INTERVIEW_QUESTION_BUNDLE_INVALID',
  DUPLICATE: 'INTERVIEW_QUESTION_DUPLICATE',
  GENERATION_CONFLICT: 'INTERVIEW_QUESTION_GENERATION_CONFLICT',
  INCONSISTENT_STATE: 'INTERVIEW_QUESTION_GENERATION_INCONSISTENT_STATE',
  SOURCE_TIMEOUT: 'INTERVIEW_QUESTION_SOURCE_TIMEOUT',
  POLICY_INVALID: 'INTERVIEW_QUESTION_POLICY_INVALID',
  FALLBACK_TO_AI: 'INTERVIEW_QUESTION_BANK_FALLBACK_TO_AI',
} as const;

export type InterviewSourceErrorCode =
  (typeof INTERVIEW_SOURCE_ERROR_CODES)[keyof typeof INTERVIEW_SOURCE_ERROR_CODES];

export interface InterviewQuestionProvenance {
  sourceType: InterviewQuestionSourceType;
  questionBankQuestionId?: string | null;
  questionBankVersionId?: string | null;
  questionBankVersionNumber?: number | null;
  questionBankCode?: string | null;
  selectionPolicyVersion?: string | null;
  selectionSeedFingerprint?: string | null;
  promptSnapshotHash?: string | null;
  selectedAt?: Date | null;
}

export interface CandidateQuestionPayload {
  order: number;
  difficulty: string; // 'EASY' | 'MEDIUM' | 'HARD'
  content: LocalizedContent;
  sourceType: InterviewQuestionSourceType;
  questionBankQuestionId?: string | null;
  questionBankVersionId?: string | null;
  questionBankVersionNumber?: number | null;
  questionBankCode?: string | null;
  selectionPolicyVersion?: string | null;
  selectionSeedFingerprint?: string | null;
  promptSnapshotHash?: string | null;
  selectedAt?: Date | null;
}

export interface ShadowDiagnostics {
  availableCount: number;
  eligibleCount: number;
  selectedCount: number;
  coverageGaps?: string[];
  selectionLatencyMs: number;
  insufficientReason: string | null;
  success: boolean;
  errorCode?: string | null;
}

export interface QuestionSourceDiagnostics {
  effectiveMode: InterviewQuestionSourceMode;
  policyVersion: string;
  selectedFromBank: number;
  selectedFromAi: number;
  eligiblePool?: number;
  fallbackReasonCode?: string | null;
  durationMs: number;
  successCode: string;
  shadowDiagnostics?: ShadowDiagnostics | null;
}

export interface ExactFiveBundle {
  sessionId: string;
  questions: CandidateQuestionPayload[];
  audit: AiUsageMetadata;
  diagnostics: QuestionSourceDiagnostics;
}

export interface QuestionSourceContext {
  sessionId: string;
  setupData: {
    jobPosition?: string;
    level?: string;
    techStacks?: string[];
    jdText?: string;
  };
  policyVersion?: string;
}

export interface IInterviewQuestionSource {
  readonly mode: InterviewQuestionSourceMode;
  generateQuestions(context: QuestionSourceContext): Promise<{
    questions: CandidateQuestionPayload[];
    audit: AiUsageMetadata;
    diagnostics?: Partial<QuestionSourceDiagnostics>;
  }>;
}

export interface QuestionBankCandidateItem {
  questionId: string;
  versionId: string;
  versionNumber: number;
  code: string;
  prompt: LocalizedContent;
  difficulty: string;
  type?: string | null;
  primaryRoleId?: string | null;
  levelIds?: string[];
  technologyIds?: string[];
}

export interface IQuestionBankSelector {
  findEligibleQuestions(filter: {
    roleId?: string;
    levelId?: string;
    technologyIds?: string[];
    excludeQuestionIds?: string[];
  }): Promise<QuestionBankCandidateItem[]>;
}
