import { ClientSession } from 'mongoose';
import { QuestionReviewAction } from '../../models/question-review.model';
import { QuestionRecord, QuestionVersionRecord } from './IQuestionRepository';

export interface QuestionReviewRecord {
  id: string;
  questionId: string;
  questionVersionId: string | null;
  revision: number;
  actorId: string;
  action: QuestionReviewAction;
  comment: string | null;
  fromState: string;
  toState: string;
  requestId: string;
  createdAt: Date;
}

export interface ReviewQueueItemRecord {
  question: QuestionRecord;
  version: QuestionVersionRecord;
}

export interface ReviewQueueQuery {
  page: number;
  limit: number;
  status?: 'IN_REVIEW' | 'APPROVED';
}

export interface ReviewQueueResult {
  items: ReviewQueueItemRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ReviewDetailRecord {
  question: QuestionRecord;
  version: QuestionVersionRecord;
  history: QuestionReviewRecord[];
  draftVersionNumber: number | null;
  currentPublishedVersionNumber: number | null;
}

export interface TransitionVersionInput {
  questionId: string;
  versionNumber: number;
  expectedRevision: number;
  from: readonly ('DRAFT' | 'IN_REVIEW' | 'APPROVED')[];
  to: 'DRAFT' | 'IN_REVIEW' | 'APPROVED';
  actorId: string;
  action: 'SUBMIT' | 'APPROVE' | 'REQUEST_CHANGES';
  reason: string | null;
  requestId: string;
}

export type WorkflowMutationResult =
  | { kind: 'updated'; question: QuestionRecord; version: QuestionVersionRecord }
  | { kind: 'question-not-found' }
  | { kind: 'version-not-found' }
  | { kind: 'retired' }
  | { kind: 'conflict'; currentRevision: number }
  | { kind: 'invalid-state'; currentState: string };

export interface PublishVersionInput {
  questionId: string;
  versionNumber: number;
  expectedRevision: number;
  actorId: string;
  reason: string | null;
  requestId: string;
}

export interface LifecycleTransitionInput {
  questionId: string;
  expectedRevision: number;
  from: 'ACTIVE' | 'RETIRED';
  to: 'ACTIVE' | 'RETIRED';
  actorId: string;
  reason: string;
  requestId: string;
}

export interface IQuestionWorkflowRepository {
  listQueue(query: ReviewQueueQuery): Promise<ReviewQueueResult>;
  findReviewDetail(questionVersionId: string): Promise<ReviewDetailRecord | null>;
  transitionVersion(
    input: TransitionVersionInput,
    session: ClientSession
  ): Promise<WorkflowMutationResult>;
  publishVersion(
    input: PublishVersionInput,
    session: ClientSession
  ): Promise<WorkflowMutationResult & { supersededVersionNumber?: number }>;
  transitionLifecycle(
    input: LifecycleTransitionInput,
    session: ClientSession
  ): Promise<Exclude<WorkflowMutationResult, { kind: 'version-not-found' } | { kind: 'retired' }>>;
}
