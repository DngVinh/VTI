export interface LocalizedContent {
  en: string;
  vi: string;
}

export interface Question {
  id?: string;
  _id?: string;
  order: number;
  difficulty: string;
  category?: string;
  content: LocalizedContent;
  candidateAnswer?: string;
  feedback?: LocalizedContent;
  score?: number;
}

export interface AnswerState {
  questionId: string;
  candidateAnswer: string;
}

export interface InterviewSession {
  id?: string;
  _id?: string;
  status: string;
  version: number;
  createdAt?: string | Date;
  setupData: {
    jobPosition?: string;
    level?: string;
    techStacks?: string[];
  };
  questions?: Question[];
  dimensions?: { name: string; score: number; reasoning: string | { vi: string; en: string } }[];
  overallScore?: number;
  learningPath?: { 
    topic: LocalizedContent; 
    priority: string; 
    suggestion: LocalizedContent 
  }[];
  personaEvaluations?: Array<{
    role: 'TECH_LEAD' | 'BAR_RAISER' | 'BEHAVIORAL' | 'JUDGE';
    score: number;
    strengths: Array<{ vi: string; en: string }>;
    weaknesses: Array<{ vi: string; en: string }>;
    specificFeedback: { vi: string; en: string };
    dimensionScores?: Record<string, number>;
  }>;
  varianceFlags?: Array<{
    dimension: string;
    variance: number;
    arbiterResolution: { vi: string; en: string };
  }>;
}

/** Chế độ nhập câu trả lời */
export type AnswerMode = 'text' | 'code' | 'star' | 'whiteboard';

export interface ArchitectureCritiqueData {
  detectedNodes: Array<{ type: string; label: string }>;
  issues: Array<{
    type: 'SPOF' | 'BOTTLENECK' | 'CONSISTENCY' | 'SECURITY' | 'MISSING_TIER';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    title: { vi: string; en: string };
    description: { vi: string; en: string };
    targetBox?: { x: number; y: number; width: number; height: number };
    suggestedFix: { vi: string; en: string };
  }>;
  tradeOffEvaluation: { vi: string; en: string };
  score: number;
}

/** Ngôn ngữ lập trình cho CodeWorkspace */
export type CodeLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'go'
  | 'cpp'
  | 'sql';

/** Dữ liệu STAR Framework */
export interface StarData {
  situation: string;
  task: string;
  action: string;
  result: string;
}

/** Chỉ số Speech Telemetry */
export interface SpeechMetrics {
  /** Số từ đã nói */
  wordCount: number;
  /** Thời gian nói tính bằng giây */
  durationSeconds: number;
  /** Tốc độ nói (words per minute) */
  wpm: number;
  /** Danh sách từ đệm phát hiện được */
  fillerWords: string[];
  /** Tổng số từ đệm */
  fillerCount: number;
}

/** Trạng thái Speech Recognition */
export interface SpeechRecognitionState {
  /** Đang lắng nghe hay không */
  isListening: boolean;
  /** Transcript tạm thời (đang nhận diện) */
  interimTranscript: string;
  /** Transcript đã xác nhận */
  finalTranscript: string;
  /** Lỗi nếu có */
  error: string | null;
  /** Trình duyệt có hỗ trợ không */
  isSupported: boolean;
}

/** Trạng thái Speech Synthesis */
export interface SpeechSynthesisState {
  /** Đang phát âm hay không */
  isSpeaking: boolean;
  /** Trình duyệt có hỗ trợ không */
  isSupported: boolean;
}

/** Trạng thái Webcam */
export interface WebcamState {
  /** Stream đang hoạt động */
  isActive: boolean;
  /** Có quyền truy cập camera */
  hasPermission: boolean | null;
  /** Có quyền truy cập microphone */
  hasMicPermission: boolean | null;
  /** Lỗi nếu có */
  error: string | null;
  /** Mức âm lượng microphone (0-100) */
  audioLevel: number;
}

export type TurnRole = 'INTERVIEWER' | 'CANDIDATE';
export type TurnType = 'INITIAL_QUESTION' | 'FOLLOW_UP' | 'ANSWER' | 'HINT' | 'SUMMARY';

export interface ConversationTurn {
  id?: string;
  _id?: string;
  sessionId?: string;
  questionId: string;
  turnIndex: number;
  role: TurnRole;
  type: TurnType;
  content: LocalizedContent;
  metadata?: {
    gapAnalysis?: Array<string | LocalizedContent>;
    difficultyAdjustment?: 'EASIER' | 'SAME' | 'HARDER';
    confidenceScore?: number;
  };
  createdAt?: string | Date;
}

export interface FollowUpResponseData {
  shouldFollowUp: boolean;
  followUpQuestion?: LocalizedContent;
  gapAnalysis: Array<string | LocalizedContent>;
  difficultyAdjustment?: 'EASIER' | 'SAME' | 'HARDER';
  turnIndex: number;
  maxTurns: number;
  summary: LocalizedContent;
}


