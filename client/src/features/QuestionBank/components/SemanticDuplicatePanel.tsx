import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiError } from '../../../auth/types';
import { questionBankApi } from '../api/questionBankApi';
import type {
  Difficulty,
  QuestionType,
  QuestionVersionInput,
  SemanticDuplicateMatch,
  SemanticDuplicateResult,
} from '../types';

interface SemanticDuplicatePanelProps {
  questionId?: string;
  versionNumber?: number;
  draft: QuestionVersionInput;
}

export const SemanticDuplicatePanel = ({
  questionId,
  versionNumber,
  draft,
}: SemanticDuplicatePanelProps) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SemanticDuplicateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(0.75);

  const handleCheckDuplicates = async () => {
    setLoading(true);
    setError(null);
    try {
      let payload;
      if (questionId && versionNumber) {
        payload = {
          target: 'EXISTING' as const,
          questionId,
          versionNumber,
          threshold,
        };
      } else {
        payload = {
          target: 'DRAFT' as const,
          draft: {
            prompt: draft.content.prompt,
            topic: draft.classification.topic,
            tags: draft.classification.tags,
            difficulty: (draft.classification.difficulty as Difficulty | null) || null,
            type: (draft.classification.type as QuestionType | null) || null,
            primaryRoleId: draft.classification.primaryRoleId,
            levelIds: draft.classification.levelIds,
            technologyIds: draft.classification.technologies.map((t) => t.technologyId),
          },
          threshold,
        };
      }

      const res = await questionBankApi.detectSemanticDuplicates(payload);
      setResult(res);
    } catch (err) {
      setError((err as ApiError).message || 'Không thể thực hiện kiểm tra trùng lặp.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreBadgeClass = (match: SemanticDuplicateMatch) => {
    if (match.matchReason === 'EXACT_FINGERPRINT' || match.similarityScore >= 0.95) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (match.similarityScore >= 0.85) {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getScoreLabel = (match: SemanticDuplicateMatch) => {
    const pct = Math.round(match.similarityScore * 100);
    if (match.matchReason === 'EXACT_FINGERPRINT') {
      return `${pct}% — Trùng khớp chính xác (Fingerprint)`;
    }
    if (match.similarityScore >= 0.85) {
      return `${pct}% — Tương đồng ngữ nghĩa cao`;
    }
    return `${pct}% — Tương đồng tiềm năng`;
  };

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
      aria-labelledby="semantic-duplicate-heading"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="semantic-duplicate-heading" className="text-xl font-extrabold text-slate-900">
            Kiểm tra trùng lặp ngữ nghĩa (Duplicate Advisory)
          </h2>
          <p className="text-xs text-slate-500">
            Cơ chế khuyến cáo: Phát hiện câu hỏi trùng khớp hoặc na ná trong ngân hàng đã publish.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            Ngưỡng:
            <input
              type="number"
              min="0.5"
              max="0.99"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleCheckDuplicates()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Đang kiểm tra…' : 'Kiểm tra trùng lặp'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3 pt-2">
          {result.matches.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <span className="font-bold">✓ Không phát hiện câu hỏi trùng lặp</span>
              <span className="text-xs text-emerald-600">
                (Không tìm thấy câu hỏi nào vượt ngưỡng tương đồng {Math.round(result.thresholdUsed * 100)}%)
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Tìm thấy <strong>{result.totalMatches}</strong> câu hỏi có khả năng trùng lặp:
                </span>
                <span className="italic text-slate-400">
                  (Advisory: Không khóa chặn quyền lưu hoặc xuất bản)
                </span>
              </div>

              <div className="space-y-2">
                {result.matches.map((match) => (
                  <div
                    key={`${match.questionId}-v${match.versionNumber}`}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${getScoreBadgeClass(
                            match
                          )}`}
                        >
                          {getScoreLabel(match)}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-600">
                          {match.code} · v{match.versionNumber}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {match.status}
                        </span>
                        <span className="text-xs text-slate-500">
                          Taxonomy overlap: {Math.round(match.taxonomyOverlap * 100)}%
                        </span>
                      </div>
                      <p className="text-sm text-slate-800 line-clamp-2">
                        {match.title.vi || match.title.en}
                      </p>
                    </div>

                    <div className="shrink-0 pt-2 sm:pt-0">
                      <Link
                        to={`/admin/question-bank/questions/${match.questionId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                      >
                        Xem câu hỏi đối chứng ↗
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
