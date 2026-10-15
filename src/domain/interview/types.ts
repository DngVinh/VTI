export interface InterviewSetupPayload {
  jobPosition?: string;
  level?: string;
  techStacks?: string[];
  jdText?: string;
  language?: 'VI' | 'EN';
  secondsPerQuestion?: number;
  strategy?: 'STANDARD' | 'ADAPTIVE';
}

export interface LocalizedContent {
  en: string;
  vi: string;
}

export interface InterviewQuestionPayload {
  order: number;
  difficulty: string;
  content: LocalizedContent;
}

export interface AnswerPayload {
  questionId: string;
  candidateAnswer: string;
}

export interface GeneratedQuestion {
  order: number;
  difficulty: string;
  category?: string;
  content: LocalizedContent;
}

export interface EvaluatedAnswer {
  questionId: string;
  feedback: LocalizedContent;
  score: number;
}

export interface EvaluationDimension {
  name: string;
  score: number;
  reasoning: string | LocalizedContent;
}

export interface LearningPathItem {
  topic: LocalizedContent;
  priority: string;
  suggestion: LocalizedContent;
}

export interface EvaluationResult {
  evaluations: EvaluatedAnswer[];
  overallScore: number;
  dimensions: EvaluationDimension[];
  learningPath: LearningPathItem[];
}

export interface LearningPathResult {
  learningPath: LearningPathItem[];
}

export interface AiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface SystemPromptContext {
  content: string;
  promptId: string;
  version: number;
  language: 'EN' | 'VI';
}

export interface IAiProvider {
  generateQuestions(
    setupData: InterviewSetupPayload,
    systemPrompt?: SystemPromptContext
  ): Promise<{
    data: GeneratedQuestion[];
    audit: AiUsageMetadata;
  }>;

  evaluateAnswers(
    questions: any[],
    answers: AnswerPayload[],
    systemPrompt?: SystemPromptContext
  ): Promise<{
    data: EvaluationResult;
    audit: AiUsageMetadata;
  }>;

  generateLearningPath?(
    questions: any[],
    answers: AnswerPayload[],
    evaluation: EvaluationResult,
    systemPrompt?: SystemPromptContext
  ): Promise<{
    data: LearningPathResult;
    audit: AiUsageMetadata;
  }>;

  generateFollowUp?(
    originalQuestion: LocalizedContent,
    candidateAnswer: string,
    history: Array<{ role: string; content: string }>,
    systemPrompt?: SystemPromptContext
  ): Promise<{
    data: FollowUpResult;
    audit: AiUsageMetadata;
  }>;

  evaluatePersona?(
    prompt: { systemInstruction: string; userContent: string }
  ): Promise<{
    data: unknown;
    audit: AiUsageMetadata;
  }>;
}

export interface FollowUpPayload {
  questionId: string;
  candidateAnswer: string;
  aiProvider?: IAiProvider;
  systemPrompt?: SystemPromptContext;
}

export interface FollowUpResult {
  shouldFollowUp: boolean;
  followUpQuestion?: LocalizedContent;
  gapAnalysis: Array<string | LocalizedContent>;
  difficultyAdjustment?: 'EASIER' | 'SAME' | 'HARDER';
  confidenceScore?: number;
  summary: LocalizedContent;
}

export interface GeneratePayload {
  setupData: InterviewSetupPayload;

  aiProvider?: IAiProvider;

  systemPrompt?: SystemPromptContext;

  useAsyncJobs?: boolean;

  jobScheduler?: import('../jobs/IJobScheduler').IJobScheduler;
}

export interface SubmitPayload {
  data: AnswerPayload[];

  aiProvider?: IAiProvider;

  systemPrompt?: SystemPromptContext;

  learningPathPrompt?: SystemPromptContext;

  useAsyncJobs?: boolean;

  jobScheduler?: import('../jobs/IJobScheduler').IJobScheduler;

  multiAgentEvaluator?: any;

  conversationTurns?: any[];
}

export interface SaveProgressPayload {
  answers: AnswerPayload[];
}

export type InterviewStatus = 
  | 'PENDING'
  | 'GENERATING'
  | 'IN_PROGRESS'
  | 'FOLLOW_UP'
  | 'EVALUATING'
  | 'COMPLETED'
  | 'FAILED';

export const LEGAL_INTERVIEW_STATUSES: readonly InterviewStatus[] = [
  'PENDING',
  'GENERATING',
  'IN_PROGRESS',
  'FOLLOW_UP',
  'EVALUATING',
  'COMPLETED',
  'FAILED',
] as const;

export interface IInterviewState {
  getName(): InterviewStatus;
  generate(context: IInterviewContext, payload: GeneratePayload): Promise<void>;
  submit(context: IInterviewContext, payload: SubmitPayload): Promise<void>;
  saveProgress(context: IInterviewContext, payload: SaveProgressPayload): Promise<void>;
}

export interface IInterviewContextRepositoryRef {
  getOwnerId(): string;
  [key: string]: any;
}

export interface IInterviewContext {
  getInterviewId(): string;
  getState(): IInterviewState;
  getRepository(): IInterviewContextRepositoryRef;
  getVersion(): number;
  getEventPublisher?(): import('../events/IEventPublisher').IEventPublisher | undefined;
  changeState(newState: IInterviewState | InterviewStatus): Promise<void>;
}

