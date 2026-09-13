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

export type ApplicationRole = 'CANDIDATE' | 'INTERVIEWER' | 'ADMIN';

const ROLE_CAPABILITIES: Readonly<Record<ApplicationRole, readonly QuestionBankCapability[]>> = {
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

export const resolveQuestionBankCapabilities = (
  role: ApplicationRole
): readonly QuestionBankCapability[] => ROLE_CAPABILITIES[role];

export const hasQuestionBankCapability = (
  role: ApplicationRole,
  capability: QuestionBankCapability
): boolean => ROLE_CAPABILITIES[role].includes(capability);
