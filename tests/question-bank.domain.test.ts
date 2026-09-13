import { describe, expect, it } from 'vitest';
import {
  createQuestionEtag,
  createQuestionVersionEtag,
  etagMatches,
  parseQuestionEtag,
  parseWeakEtag,
} from '../src/domain/question-bank/etag';
import {
  canonicalJsonStringify,
  createContentHash,
  normalizePromptFingerprint,
} from '../src/domain/question-bank/hashing';
import {
  createIdempotencyFingerprint,
  createIdempotencyKeyHash,
} from '../src/domain/question-bank/idempotency';
import {
  assertCanCreateDraft,
  assertDraftMutable,
  assertFourEyes,
  assertQuestionComplete,
  assertRubricValid,
  assertVersionTransitionAllowed,
  isKebabCase,
  isVersionTransitionAllowed,
  normalizeTags,
  uniqueIds,
  validateRubric,
  validateQuestionCompleteness,
} from '../src/domain/question-bank/policies';
import { createEmptyQuestionVersionDraft } from '../src/domain/question-bank/types';
import { resolveQuestionBankCapabilities } from '../src/domain/question-bank/capabilities';
import {
  buildSafeQuestionSearchRegex,
  escapeQuestionSearch,
} from '../src/repositories/question.repository';
import {
  toQuestionAdminListDto,
  toQuestionVersionAdminDetailDto,
} from '../src/mappers/question-bank.mapper';
import type {
  QuestionListProjection,
  QuestionVersionRecord,
} from '../src/repositories/interfaces/IQuestionRepository';
import { updateQuestionVersionSchema } from '../src/validators/question-bank.validator';

const now = new Date('2026-09-10T00:00:00.000Z');

const versionRecord = (): QuestionVersionRecord => ({
  id: '64b000000000000000000002',
  questionId: '64b000000000000000000001',
  versionNumber: 1,
  status: 'DRAFT',
  revision: 3,
  ...createEmptyQuestionVersionDraft(),
  prompt: { vi: '  Node.js là gì?  ', en: 'What is Node.js?' },
  referenceAnswer: { vi: 'Restricted answer', en: 'Restricted answer' },
  rubric: [
    {
      key: 'accuracy',
      title: { vi: 'Độ chính xác', en: 'Accuracy' },
      description: { vi: null, en: null },
      weight: 100,
      levels: [{ score: 4, description: { vi: 'Tốt', en: 'Good' } }],
    },
  ],
  origin: 'MANUAL',
  sourceVersionId: null,
  sourceReference: null,
  createdBy: '64b000000000000000000003',
  updatedBy: '64b000000000000000000003',
  contributorIds: ['64b000000000000000000003'],
  createdAt: now,
  updatedAt: now,
});

describe('Question Bank domain foundation', () => {
  it('canonicalizes key order, Unicode and line endings deterministically', () => {
    const first = { b: 'e\u0301\r\nline', a: [2, 1] };
    const second = { a: [2, 1], b: 'é\nline' };
    expect(canonicalJsonStringify(first)).toBe(canonicalJsonStringify(second));
    expect(createContentHash(first)).toBe(createContentHash(second));
    expect(normalizePromptFingerprint({ vi: '  XIN   Chào ', en: null })).toBe(
      normalizePromptFingerprint({ vi: 'xin chào', en: '' })
    );
  });

  it('enforces Draft-only editing and immutable published/superseded versions', () => {
    expect(() => assertDraftMutable('DRAFT')).not.toThrow();
    expect(() => assertDraftMutable('PUBLISHED')).toThrowError(/không thể chỉnh sửa/i);
    expect(() => assertDraftMutable('SUPERSEDED')).toThrowError(/không thể chỉnh sửa/i);
    expect(() => assertDraftMutable('IN_REVIEW')).toThrowError(/không thể chỉnh sửa/i);
  });

  it('validates rubric cardinality, unique keys/scores and total weight', () => {
    const invalid = versionRecord().rubric.concat({
      key: 'accuracy',
      title: { vi: null, en: null },
      description: { vi: null, en: null },
      weight: 50,
      levels: [
        { score: 4, description: { vi: null, en: null } },
        { score: 4, description: { vi: null, en: null } },
      ],
    });
    const issues = validateRubric(invalid);
    expect(issues.map((issue) => issue.message).join(' ')).toMatch(/trùng/i);
    expect(issues.map((issue) => issue.message).join(' ')).toMatch(/100/);
    expect(() => assertRubricValid(invalid)).toThrowError(/rubric/i);
  });

  it('normalizes and deduplicates tags', () => {
    expect(normalizeTags([' Node JS ', 'node_js', 'TypeScript'])).toEqual([
      'node-js',
      'typescript',
    ]);
  });

  it('generates and parses deterministic weak ETags', () => {
    const question = createQuestionEtag('64B000000000000000000001', 8);
    const version = createQuestionVersionEtag('64b000000000000000000002', 3);
    expect(question).toBe('W/"question:64b000000000000000000001:8"');
    expect(parseQuestionEtag(version, 'question-version')).toEqual({
      kind: 'question-version',
      id: '64b000000000000000000002',
      revision: 3,
    });
    expect(parseQuestionEtag('"strong"')).toBeNull();
    expect(parseQuestionEtag(question, 'question-version')).toBeNull();
    expect(parseQuestionEtag(question, 'question', '64b000000000000000000099')).toBeNull();
    expect(parseWeakEtag('W/"question:invalid:1"')).toBeNull();
    expect(etagMatches(question, {
      kind: 'question',
      id: '64b000000000000000000001',
      revision: 8,
    })).toBe(true);
    expect(etagMatches(question, {
      kind: 'question',
      id: '64b000000000000000000001',
      revision: 9,
    })).toBe(false);
    expect(() => createQuestionEtag('invalid', 0)).toThrow(TypeError);
    expect(() => createQuestionEtag('64b000000000000000000001', -1)).toThrow(TypeError);
  });

  it('enforces transition and active-Draft creation policy branches', () => {
    expect(isVersionTransitionAllowed('DRAFT', 'IN_REVIEW')).toBe(true);
    expect(isVersionTransitionAllowed('DRAFT', 'PUBLISHED')).toBe(false);
    expect(() => assertVersionTransitionAllowed('DRAFT', 'PUBLISHED')).toThrowError(
      /không thể chuyển/i
    );
    expect(() => assertCanCreateDraft('ACTIVE', false)).not.toThrow();
    expect(() => assertCanCreateDraft('RETIRED', false)).toThrowError(/ngừng sử dụng/i);
    expect(() => assertCanCreateDraft('ACTIVE', true)).toThrowError(/bản nháp/i);
    expect(uniqueIds(['a', 'a', 'b'])).toEqual(['a', 'b']);
    expect(isKebabCase('node-js')).toBe(true);
    expect(isKebabCase('Node JS')).toBe(false);
    expect(validateRubric([])).toEqual([]);
  });

  it('creates deterministic scoped idempotency fingerprints without storing the raw key', () => {
    const one = createIdempotencyFingerprint({
      scope: 'admin',
      route: 'POST /questions',
      payload: { en: 'Hello', vi: 'Xin chào' },
    });
    const two = createIdempotencyFingerprint({
      payload: { vi: 'Xin chào', en: 'Hello' },
      route: 'POST /questions',
      scope: 'admin',
    });
    expect(one).toBe(two);
    expect(createIdempotencyKeyHash('raw-secret-key-1234')).toHaveLength(64);
    expect(createIdempotencyKeyHash('raw-secret-key-1234')).not.toContain('raw-secret');
  });

  it('escapes user search metacharacters rather than accepting arbitrary regex', () => {
    expect(escapeQuestionSearch('node.*(js)')).toBe('node\\.\\*\\(js\\)');
    const regex = buildSafeQuestionSearchRegex('node.*(js)');
    expect(regex.test('node.*(js)')).toBe(true);
    expect(regex.test('nodeZZjs')).toBe(false);
  });

  it('maps ADMIN capabilities and keeps non-admin roles ungranted', () => {
    expect(resolveQuestionBankCapabilities('ADMIN')).toEqual([
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
    ]);
    expect(resolveQuestionBankCapabilities('CANDIDATE')).toEqual([]);
  });

  it('rejects structurally empty Draft patches while allowing explicit clears', () => {
    const request = (body: unknown) => ({ body, query: {}, params: {
      questionId: '64b000000000000000000001',
      versionNumber: '1',
    } });

    expect(updateQuestionVersionSchema.safeParse(request({ content: {} })).success).toBe(false);
    expect(updateQuestionVersionSchema.safeParse(request({ classification: { tags: [] } })).success).toBe(true);
    expect(updateQuestionVersionSchema.safeParse(request({ changeSummary: null })).success).toBe(true);
  });

  it('enforces Phase 2 transitions, completeness, and four-eyes separation', () => {
    expect(isVersionTransitionAllowed('APPROVED', 'DRAFT')).toBe(true);
    expect(isVersionTransitionAllowed('PUBLISHED', 'DRAFT')).toBe(false);

    const incomplete = createEmptyQuestionVersionDraft();
    expect(validateQuestionCompleteness(incomplete).map((issue) => issue.field)).toContain('rubric');
    expect(() => assertQuestionComplete(incomplete)).toThrow(/chưa đủ điều kiện/);

    const complete = versionRecord();
    complete.classificationComplete = true;
    complete.questionType = 'TECHNICAL';
    complete.difficulty = 'MEDIUM';
    complete.primaryRoleId = '64b000000000000000000004';
    complete.levelIds = ['64b000000000000000000005'];
    complete.technologyAgnostic = false;
    complete.technologies = [{ technologyId: '64b000000000000000000006', relevance: 100 }];
    complete.rubric[0].weight = 50;
    complete.rubric.push({
      key: 'communication',
      title: { vi: 'Trình bày', en: 'Communication' },
      description: { vi: null, en: null },
      weight: 50,
      levels: [{ score: 4, description: { vi: 'Rõ ràng', en: 'Clear' } }],
    });
    expect(() => assertQuestionComplete(complete)).not.toThrow();

    expect(() => assertFourEyes(
      '64b000000000000000000003',
      complete.contributorIds,
      true
    )).toThrow(/không được tự phê duyệt/);
    expect(() => assertFourEyes(
      '64b000000000000000000007',
      complete.contributorIds,
      true
    )).not.toThrow();
    expect(() => assertFourEyes(
      '64b000000000000000000003',
      complete.contributorIds,
      false
    )).not.toThrow();
  });

  it('uses explicit DTO allowlists and does not disclose restricted list fields', () => {
    const version = versionRecord();
    const list: QuestionListProjection = {
      question: {
        id: version.questionId,
        code: 'QB-2026-000001',
        lifecycleStatus: 'ACTIVE',
        currentPublishedVersionId: null,
        draftVersionId: version.id,
        latestVersionNumber: 1,
        ownerId: version.createdBy,
        revision: 0,
        createdBy: version.createdBy,
        updatedBy: version.updatedBy,
        createdAt: now,
        updatedAt: now,
      },
      draftStatus: 'DRAFT',
      selectionStatus: 'UNAVAILABLE',
      draftVersionNumber: 1,
      currentPublishedVersionNumber: null,
      displayVersion: version,
    };
    const dto = toQuestionAdminListDto(list);
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain('Restricted answer');
    expect(serialized).not.toContain('rubric');
    expect(serialized).not.toContain('createdBy');
    expect(toQuestionVersionAdminDetailDto(version).answer.referenceAnswer.vi).toBe(
      'Restricted answer'
    );
  });
});
