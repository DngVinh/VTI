import { describe, expect, it } from 'vitest';
import { emptyQuestionVersionInput } from '../types';
import { validateQuestionDraft } from './questionBankSchemas';

describe('Question Bank client validation', () => {
  it('allows an incomplete Draft but requires one authoring field for create', () => {
    const empty = emptyQuestionVersionInput();
    expect(validateQuestionDraft(empty).valid).toBe(true);
    expect(validateQuestionDraft(empty, true).errors.form).toBeDefined();
    empty.content.prompt.vi = 'Sự khác nhau giữa let và const là gì?';
    expect(validateQuestionDraft(empty, true).valid).toBe(true);
  });

  it('rejects duplicate taxonomy, invalid control characters and incomplete technology classification', () => {
    const draft = emptyQuestionVersionInput();
    const id = '507f1f77bcf86cd799439011';
    draft.content.prompt.vi = 'Unsafe\u0000prompt';
    draft.classification.additionalRoleIds = [id, id];
    draft.classification.classificationComplete = true;
    const result = validateQuestionDraft(draft);
    expect(result.errors['content.prompt.vi']).toBeDefined();
    expect(result.errors['classification.additionalRoleIds']).toBeDefined();
    expect(result.errors['classification.technologies']).toBeDefined();
  });

  it('enforces two criteria, unique keys, levels and total weight', () => {
    const draft = emptyQuestionVersionInput();
    const criterion = {
      key: 'technical-depth',
      title: { vi: 'Chiều sâu', en: 'Depth' },
      weight: 40,
      levels: [0, 0].map((score) => ({ score, description: { vi: '', en: '' } })),
    };
    draft.rubric = [criterion, { ...criterion }];
    const result = validateQuestionDraft(draft);
    expect(result.errors.rubric).toBeDefined();
    expect(Object.keys(result.errors).some((key) => key.includes('levels'))).toBe(true);
  });
});

