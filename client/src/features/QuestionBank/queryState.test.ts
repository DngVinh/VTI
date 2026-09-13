import { describe, expect, it } from 'vitest';
import { hasQuestionListFilters, parseQuestionListQuery, replaceQueryValue } from './queryState';

describe('Question Bank URL state', () => {
  it('parses bounded pagination and whitelisted sorting', () => {
    const query = parseQuestionListQuery(new URLSearchParams('page=2&limit=500&sortBy=unsafe&sortOrder=sideways&search= node '));
    expect(query).toEqual({ page: 2, limit: 100, sortBy: 'updatedAt', sortOrder: 'desc', search: 'node' });
  });

  it('ignores a one-character search and detects real filters', () => {
    expect(hasQuestionListFilters(parseQuestionListQuery(new URLSearchParams('search=x')))).toBe(false);
    expect(hasQuestionListFilters(parseQuestionListQuery(new URLSearchParams('status=DRAFT')))).toBe(true);
  });

  it('resets page when a filter changes but not for explicit pagination', () => {
    const current = new URLSearchParams('page=4&status=DRAFT');
    expect(replaceQueryValue(current, 'difficulty', 'HARD').get('page')).toBe('1');
    expect(replaceQueryValue(current, 'page', '3', false).get('page')).toBe('3');
  });
});

