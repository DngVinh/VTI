import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ApiError } from '../../../auth/types';
import { questionBankApi } from '../api/questionBankApi';
import { hasQuestionListFilters, parseQuestionListQuery, replaceQueryValue } from '../queryState';
import type { Pagination, QuestionSummaryDto } from '../types';

const SEARCH_DEBOUNCE_MS = 400;
const EMPTY_PAGINATION: Pagination = { page: 1, limit: 20, total: 0, totalPages: 0 };

export const useQuestionBankList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const query = useMemo(() => parseQuestionListQuery(new URLSearchParams(queryKey)), [queryKey]);
  const [searchDraft, setSearchDraft] = useState({
    value: searchParams.get('search') ?? '',
    sourceQueryKey: queryKey,
  });
  const searchInput = searchDraft.sourceQueryKey === queryKey
    ? searchDraft.value
    : searchParams.get('search') ?? '';
  const setSearchInput = (value: string) => {
    setSearchDraft({ value, sourceQueryKey: queryKey });
  };
  const [items, setItems] = useState<QuestionSummaryDto[]>([]);
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const trimmed = searchInput.trim();
    const timer = window.setTimeout(() => {
      const safeSearch = trimmed.length >= 2 && trimmed.length <= 200 ? trimmed : undefined;
      const current = searchParams.get('search') ?? undefined;
      if (safeSearch !== current) {
        setIsLoading(true);
        setError(null);
        setSearchParams(replaceQueryValue(searchParams, 'search', safeSearch));
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchParams, setSearchParams]);

  useEffect(() => {
    const controller = new AbortController();
    void questionBankApi.listQuestions(query, controller.signal)
      .then((result) => {
        setItems(result.items);
        setPagination(result.pagination);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        const apiError = caught as ApiError;
        setError(apiError.message || 'Không thể tải ngân hàng câu hỏi.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [query, reloadKey]);

  const setQueryValue = (key: string, value?: string, resetPage = true) => {
    setIsLoading(true);
    setError(null);
    setSearchParams(replaceQueryValue(searchParams, key, value, resetPage));
  };

  return {
    query,
    searchInput,
    setSearchInput,
    items,
    pagination,
    isLoading,
    error,
    hasActiveFilters: hasQuestionListFilters(query),
    setQueryValue,
    retry: () => {
      setIsLoading(true);
      setError(null);
      setReloadKey((current) => current + 1);
    },
  };
};

