import {
  DomainValidationIssue,
  QuestionBankDomainError,
} from './errors';
import {
  LocalizedText,
  QuestionVersionDraftFields,
  QuestionLifecycleStatus,
  RubricCriterion,
  VersionStatus,
} from './types';

const VERSION_TRANSITIONS: Readonly<Record<VersionStatus, readonly VersionStatus[]>> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['DRAFT', 'APPROVED'],
  APPROVED: ['DRAFT', 'PUBLISHED'],
  PUBLISHED: ['SUPERSEDED'],
  SUPERSEDED: [],
};

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isVersionTransitionAllowed = (
  from: VersionStatus,
  to: VersionStatus
): boolean => VERSION_TRANSITIONS[from].includes(to);

export const assertVersionTransitionAllowed = (
  from: VersionStatus,
  to: VersionStatus
): void => {
  if (!isVersionTransitionAllowed(from, to)) {
    throw new QuestionBankDomainError(
      'QUESTION_INVALID_STATE_TRANSITION',
      `Không thể chuyển phiên bản từ ${from} sang ${to}`
    );
  }
};

export const assertDraftMutable = (status: VersionStatus): void => {
  if (status === 'PUBLISHED' || status === 'SUPERSEDED') {
    throw new QuestionBankDomainError(
      'QUESTION_VERSION_IMMUTABLE',
      'Phiên bản đã xuất bản hoặc được thay thế không thể chỉnh sửa'
    );
  }

  if (status !== 'DRAFT') {
    throw new QuestionBankDomainError(
      'QUESTION_INVALID_STATE_TRANSITION',
      `Phiên bản ở trạng thái ${status} không thể chỉnh sửa như bản nháp`
    );
  }
};

export const assertCanCreateDraft = (
  lifecycleStatus: QuestionLifecycleStatus,
  hasActiveDraft: boolean
): void => {
  if (lifecycleStatus !== 'ACTIVE') {
    throw new QuestionBankDomainError(
      'QUESTION_INVALID_STATE_TRANSITION',
      'Không thể tạo bản nháp cho câu hỏi đã ngừng sử dụng'
    );
  }

  if (hasActiveDraft) {
    throw new QuestionBankDomainError(
      'QUESTION_ACTIVE_DRAFT_EXISTS',
      'Câu hỏi đã có một bản nháp đang hoạt động'
    );
  }
};

export const normalizeTag = (value: string): string =>
  value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

export const normalizeTags = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const tag = normalizeTag(value);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      normalized.push(tag);
    }
  }

  return normalized;
};

export const uniqueIds = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
};

export const validateRubric = (
  rubric: readonly RubricCriterion[]
): DomainValidationIssue[] => {
  const issues: DomainValidationIssue[] = [];

  if (rubric.length === 0) {
    return issues;
  }

  if (rubric.length < 2 || rubric.length > 10) {
    issues.push({
      field: 'rubric',
      message: 'Rubric phải có từ 2 đến 10 tiêu chí khi được khai báo',
    });
  }

  const criterionKeys = new Set<string>();
  let totalWeight = 0;

  rubric.forEach((criterion, criterionIndex) => {
    const keyField = `rubric.${criterionIndex}.key`;
    if (!KEBAB_CASE.test(criterion.key)) {
      issues.push({
        field: keyField,
        message: 'Khóa rubric phải ở định dạng kebab-case',
      });
    }
    if (criterionKeys.has(criterion.key)) {
      issues.push({
        field: keyField,
        message: 'Khóa rubric không được trùng lặp',
      });
    }
    criterionKeys.add(criterion.key);

    if (!Number.isInteger(criterion.weight) || criterion.weight < 1 || criterion.weight > 100) {
      issues.push({
        field: `rubric.${criterionIndex}.weight`,
        message: 'Trọng số rubric phải là số nguyên từ 1 đến 100',
      });
    } else {
      totalWeight += criterion.weight;
    }

    const scores = new Set<number>();
    criterion.levels.forEach((level, levelIndex) => {
      if (!Number.isInteger(level.score) || level.score < 0 || level.score > 4) {
        issues.push({
          field: `rubric.${criterionIndex}.levels.${levelIndex}.score`,
          message: 'Điểm rubric phải là số nguyên từ 0 đến 4',
        });
      }
      if (scores.has(level.score)) {
        issues.push({
          field: `rubric.${criterionIndex}.levels.${levelIndex}.score`,
          message: 'Điểm rubric không được trùng trong cùng tiêu chí',
        });
      }
      scores.add(level.score);
    });
  });

  if (totalWeight !== 100) {
    issues.push({
      field: 'rubric',
      message: 'Tổng trọng số rubric phải bằng 100',
    });
  }

  return issues;
};

export const assertRubricValid = (rubric: readonly RubricCriterion[]): void => {
  const issues = validateRubric(rubric);
  if (issues.length > 0) {
    throw new QuestionBankDomainError(
      'VALIDATION_ERROR',
      'Dữ liệu rubric không hợp lệ',
      issues
    );
  }
};

export const isKebabCase = (value: string): boolean => KEBAB_CASE.test(value);

const hasText = (value: string | null): boolean => Boolean(value?.trim());

const hasLocalizedText = (value: LocalizedText): boolean =>
  hasText(value.vi) || hasText(value.en);

export const validateQuestionCompleteness = (
  version: QuestionVersionDraftFields
): DomainValidationIssue[] => {
  const issues: DomainValidationIssue[] = [];
  if (!hasLocalizedText(version.prompt)) {
    issues.push({ field: 'content.prompt', message: 'Cần ít nhất một prompt VI hoặc EN' });
  }
  if (!version.classificationComplete) {
    issues.push({ field: 'classification.classificationComplete', message: 'Classification chưa hoàn chỉnh' });
  }
  if (!version.questionType) {
    issues.push({ field: 'classification.type', message: 'Loại câu hỏi là bắt buộc' });
  }
  if (!version.difficulty) {
    issues.push({ field: 'classification.difficulty', message: 'Độ khó là bắt buộc' });
  }
  if (!version.primaryRoleId) {
    issues.push({ field: 'classification.primaryRoleId', message: 'Primary role là bắt buộc' });
  }
  if (version.levelIds.length === 0) {
    issues.push({ field: 'classification.levelIds', message: 'Cần ít nhất một level' });
  }
  if (version.technologyAgnostic === null) {
    issues.push({ field: 'classification.technologyAgnostic', message: 'Phải xác định technology-agnostic' });
  } else if (version.technologyAgnostic && version.technologies.length > 0) {
    issues.push({ field: 'classification.technologies', message: 'Câu hỏi agnostic không được gán technology' });
  } else if (!version.technologyAgnostic && version.technologies.length === 0) {
    issues.push({ field: 'classification.technologies', message: 'Cần ít nhất một technology' });
  }
  if (hasText(version.prompt.vi) && !hasText(version.referenceAnswer.vi)) {
    issues.push({ field: 'answer.referenceAnswer.vi', message: 'Reference answer VI là bắt buộc cho prompt VI' });
  }
  if (hasText(version.prompt.en) && !hasText(version.referenceAnswer.en)) {
    issues.push({ field: 'answer.referenceAnswer.en', message: 'Reference answer EN là bắt buộc cho prompt EN' });
  }
  if (version.rubric.length === 0) {
    issues.push({ field: 'rubric', message: 'Rubric là bắt buộc' });
  }
  issues.push(...validateRubric(version.rubric));
  version.rubric.forEach((criterion, criterionIndex) => {
    if (!hasLocalizedText(criterion.title)) {
      issues.push({ field: `rubric.${criterionIndex}.title`, message: 'Tiêu đề rubric là bắt buộc' });
    }
    criterion.levels.forEach((level, levelIndex) => {
      if (!hasLocalizedText(level.description)) {
        issues.push({
          field: `rubric.${criterionIndex}.levels.${levelIndex}.description`,
          message: 'Mô tả mức rubric là bắt buộc',
        });
      }
    });
  });
  return issues;
};

export const assertQuestionComplete = (version: QuestionVersionDraftFields): void => {
  const issues = validateQuestionCompleteness(version);
  if (issues.length) {
    throw new QuestionBankDomainError(
      'QUESTION_CONTENT_INCOMPLETE',
      'Nội dung câu hỏi chưa đủ điều kiện review/publish',
      issues
    );
  }
};

export const assertFourEyes = (
  actorId: string,
  contributorIds: readonly string[],
  enabled: boolean
): void => {
  if (enabled && contributorIds.some((id) => id.toLowerCase() === actorId.toLowerCase())) {
    throw new QuestionBankDomainError(
      'QUESTION_FOUR_EYES_VIOLATION',
      'Người tạo hoặc cập nhật Draft không được tự phê duyệt/xuất bản'
    );
  }
};
