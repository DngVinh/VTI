import type { Role } from '../../auth/types';

export type QuestionBankCapability =
  | 'QUESTION_READ'
  | 'QUESTION_AUTHOR'
  | 'QUESTION_REVIEW'
  | 'QUESTION_PUBLISH'
  | 'QUESTION_LIFECYCLE_MANAGE'
  | 'QUESTION_SELECT'
  | 'QUESTION_ANALYTICS'
  | 'QUESTION_IMPORT_EXPORT'
  | 'QUESTION_AI_GENERATE'
  | 'QUESTION_AI_TRANSLATE'
  | 'QUESTION_DUPLICATE_READ'
  | 'QUESTION_EMBEDDING_MANAGE';

const capabilities: Record<Role, readonly QuestionBankCapability[]> = {
  ADMIN: [
    'QUESTION_READ',
    'QUESTION_AUTHOR',
    'QUESTION_REVIEW',
    'QUESTION_PUBLISH',
    'QUESTION_LIFECYCLE_MANAGE',
    'QUESTION_SELECT',
    'QUESTION_ANALYTICS',
    'QUESTION_IMPORT_EXPORT',
    'QUESTION_AI_GENERATE',
    'QUESTION_AI_TRANSLATE',
    'QUESTION_DUPLICATE_READ',
    'QUESTION_EMBEDDING_MANAGE',
  ],
  CANDIDATE: [],
  INTERVIEWER: [],
};

export const hasQuestionBankCapability = (
  role: Role | undefined,
  capability: QuestionBankCapability
): boolean => Boolean(role && capabilities[role].includes(capability));

