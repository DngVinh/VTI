import { InterviewEntity, InterviewQuestionEntity } from '../../repositories/IInterviewRepository';

export interface CandidateSafeInterviewQuestion {
  id: string;
  sessionId: string;
  order: number;
  difficulty: string;
  content: {
    en: string;
    vi: string;
  };
  candidateAnswer: string | null;
  feedback: {
    en: string;
    vi: string;
  } | null;
  score: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidateSafeInterviewSession {
  id: string;
  userId?: string;
  status: string;
  setupData: any;
  questions?: CandidateSafeInterviewQuestion[];
  dimensions?: { name: string; score: number; reasoning: string }[] | null;
  overallScore?: number | null;
  learningPath?: {
    topic: { en: string; vi: string };
    priority: string;
    suggestion: { en: string; vi: string };
  }[] | null;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export const toCandidateSafeInterviewQuestion = (
  raw: any
): CandidateSafeInterviewQuestion => {
  const id = raw._id ? raw._id.toString() : raw.id?.toString();
  const sessionId = raw.sessionId ? raw.sessionId.toString() : '';

  return {
    id,
    sessionId,
    order: raw.order,
    difficulty: raw.difficulty,
    content: {
      en: raw.content?.en ?? '',
      vi: raw.content?.vi ?? '',
    },
    candidateAnswer: raw.candidateAnswer ?? null,
    feedback: raw.feedback
      ? {
          en: raw.feedback.en ?? '',
          vi: raw.feedback.vi ?? '',
        }
      : null,
    score: raw.score ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

export const toCandidateSafeInterviewSession = (
  session: InterviewEntity | any
): CandidateSafeInterviewSession => {
  if (!session) return session;

  const questions = Array.isArray(session.questions)
    ? session.questions.map(toCandidateSafeInterviewQuestion)
    : undefined;

  return {
    id: session.id?.toString() ?? session._id?.toString(),
    userId: session.userId,
    status: session.status,
    setupData: session.setupData,
    questions,
    dimensions: session.dimensions,
    overallScore: session.overallScore,
    learningPath: session.learningPath,
    metadata: session.metadata,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
};
