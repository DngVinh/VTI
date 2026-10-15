import { InterviewStatus, InterviewSetupPayload, LocalizedContent } from '../domain/interview/types';

export interface InterviewPromptVersion {
  promptId: string;
  version: number;
  language: 'EN' | 'VI';
}

export interface InterviewQuestionEntity {
  id: string;
  sessionId: string;
  order: number;
  difficulty: string;
  content: LocalizedContent;
  candidateAnswer: string | null;
  answerVersion?: number;
  feedback: LocalizedContent | null;
  score: number | null;
  sourceType?: 'AI_GENERATED' | 'QUESTION_BANK';
  questionBankQuestionId?: string | null;
  questionBankVersionId?: string | null;
  questionBankVersionNumber?: number | null;
  questionBankCode?: string | null;
  selectionPolicyVersion?: string | null;
  selectionSeedFingerprint?: string | null;
  promptSnapshotHash?: string | null;
  selectedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterviewEntity {
  id: string;
  userId?: string;
  status: InterviewStatus;
  version: number;
  rubricVersion: number;
  submissionVersion: number;
  activeOperationId?: string | null;
  safeErrorCode?: string | null;
  setupData: InterviewSetupPayload;
  questions?: InterviewQuestionEntity[];
  dimensions?: { name: string; score: number; reasoning: string | LocalizedContent }[] | null;
  overallScore?: number | null;
  learningPath?: {
    topic: LocalizedContent;
    priority: string;
    suggestion: LocalizedContent;
  }[] | null;
  personaEvaluations?: Array<{
    role: 'TECH_LEAD' | 'BAR_RAISER' | 'BEHAVIORAL' | 'JUDGE';
    score: number;
    strengths: Array<{ en: string; vi: string }>;
    weaknesses: Array<{ en: string; vi: string }>;
    specificFeedback: { en: string; vi: string };
    dimensionScores?: Record<string, number>;
  }>;
  varianceFlags?: Array<{
    dimension: string;
    variance: number;
    arbiterResolution: { en: string; vi: string };
  }>;
  promptVersions?: {
    generation?: InterviewPromptVersion;
    evaluation?: InterviewPromptVersion;
    learningPath?: InterviewPromptVersion;
  };
  metadata?: import('../domain/interview/types').AiUsageMetadata;
  createdAt: Date;
  updatedAt: Date;
  terminalAt?: Date;
  contentPurgeAt?: Date;
  recordPurgeAt?: Date;
}

export interface IInterviewRepository {
  forOwner(ownerId: string): IInterviewRepository;
  getOwnerId(): string;
  create(data: InterviewSetupPayload, userId?: string): Promise<InterviewEntity>;
  findById(id: string): Promise<InterviewEntity | null>;
  updateStatus(
    id: string,
    status: InterviewStatus,
    expectedStatus?: InterviewStatus,
    expectedVersion?: number
  ): Promise<number | null>;
  update(id: string, data: Partial<InterviewEntity>): Promise<void>;
  updateTokenUsage(
    id: string,
    usage: import('../domain/interview/types').AiUsageMetadata,
  ): Promise<void>;
  updatePromptVersion(
    id: string,
    type: 'generation' | 'evaluation' | 'learningPath',
    promptVersion: InterviewPromptVersion,
  ): Promise<void>;

  createQuestions(
    sessionId: string,
    questions: Omit<
      InterviewQuestionEntity,
      'id' | 'sessionId' | 'createdAt' | 'updatedAt' | 'candidateAnswer' | 'feedback' | 'score'
    >[],
  ): Promise<InterviewQuestionEntity[]>;
  commitInterviewQuestionsBundle(
    sessionId: string,
    bundle: import('../domain/interview/question-source/types').ExactFiveBundle,
  ): Promise<InterviewEntity>;
  updateQuestionAnswer(questionId: string, answer: string, sessionId?: string): Promise<void>;
  updateQuestionFeedback(
    questionId: string,
    feedback: LocalizedContent,
    score: number,
    sessionId?: string,
  ): Promise<void>;
}
