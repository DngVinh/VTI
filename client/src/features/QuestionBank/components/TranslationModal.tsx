import { useState } from 'react';
import type { ApiError } from '../../../auth/types';
import { questionBankApi, createIdempotencyKey, createVersionEtag } from '../api/questionBankApi';
import type {
  QuestionVersionAdminDetailDto,
  QuestionVersionInput,
  TranslationField,
  TranslationPreviewResult,
} from '../types';

interface TranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionId: string;
  versionNumber: number;
  currentDraft: QuestionVersionInput;
  etag: string | null;
  onApplied: (updated: QuestionVersionAdminDetailDto, newEtag: string) => void;
}

const ALL_FIELDS: { id: TranslationField; label: string }[] = [
  { id: 'prompt', label: 'Prompt / Câu hỏi' },
  { id: 'explanation', label: 'Giải thích (Explanation)' },
  { id: 'referenceAnswer', label: 'Câu trả lời mẫu (Reference Answer)' },
  { id: 'learningObjective', label: 'Mục tiêu đánh giá (Learning Objective)' },
  { id: 'followUps', label: 'Câu hỏi tiếp nối (Follow-ups)' },
  { id: 'rubric', label: 'Tiêu chí chấm điểm (Rubric)' },
];

export const TranslationModal = ({
  isOpen,
  onClose,
  questionId,
  versionNumber,
  etag,
  onApplied,
}: TranslationModalProps) => {
  const [sourceLocale, setSourceLocale] = useState<'vi' | 'en'>('vi');
  const [targetLocale, setTargetLocale] = useState<'vi' | 'en'>('en');
  const [selectedFields, setSelectedFields] = useState<TranslationField[]>([
    'prompt',
    'explanation',
    'referenceAnswer',
    'learningObjective',
  ]);
  const [preview, setPreview] = useState<TranslationPreviewResult | null>(null);
  const [chosenFields, setChosenFields] = useState<Record<TranslationField, boolean>>({
    prompt: true,
    explanation: true,
    referenceAnswer: true,
    learningObjective: true,
    followUps: true,
    rubric: true,
  });
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSourceChange = (src: 'vi' | 'en') => {
    setSourceLocale(src);
    setTargetLocale(src === 'vi' ? 'en' : 'vi');
    setPreview(null);
    setError(null);
  };

  const toggleField = (field: TranslationField) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
    setPreview(null);
  };

  const handlePreview = async () => {
    if (selectedFields.length === 0) {
      setError('Vui lòng chọn ít nhất một trường để dịch.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await questionBankApi.previewTranslation(questionId, versionNumber, {
        sourceLocale,
        targetLocale,
        fields: selectedFields,
      });
      setPreview(result);
      const initialChosen: Record<TranslationField, boolean> = {
        prompt: false,
        explanation: false,
        referenceAnswer: false,
        learningObjective: false,
        followUps: false,
        rubric: false,
      };
      result.fields.forEach((f) => {
        initialChosen[f.field] = true;
      });
      setChosenFields(initialChosen);
      setConfirmOverwrite(false);
    } catch (err) {
      setError((err as ApiError).message || 'Không thể tạo bản xem trước dịch thuật.');
    } finally {
      setLoading(false);
    }
  };

  const hasAnyOverwrite =
    preview?.fields.some((f) => chosenFields[f.field] && f.wouldOverwrite) ?? false;

  const handleApply = async () => {
    if (!preview || !etag) return;
    const fieldsToApply = preview.fields
      .filter((f) => chosenFields[f.field])
      .map((f) => f.field);

    if (fieldsToApply.length === 0) {
      setError('Vui lòng chọn ít nhất một trường để áp dụng.');
      return;
    }

    if (hasAnyOverwrite && !confirmOverwrite) {
      setError('Cần xác nhận đồng ý ghi đè nội dung hiện có.');
      return;
    }

    setApplying(true);
    setError(null);
    try {
      const idempotencyKey = createIdempotencyKey();
      const result = await questionBankApi.applyTranslation(
        questionId,
        versionNumber,
        {
          sourceLocale,
          targetLocale,
          fields: fieldsToApply,
          confirmOverwrite,
          translations: preview.proposed,
        },
        etag,
        idempotencyKey
      );

      const nextEtag = result.etag ?? createVersionEtag(result.data);
      onApplied(result.data, nextEtag);
      onClose();
    } catch (err) {
      setError((err as ApiError).message || 'Lỗi khi áp dụng bản dịch.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="translation-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="translation-modal-title" className="text-xl font-bold text-slate-900">
              AI-Assisted Bilingual Translation (Dịch song ngữ)
            </h2>
            <p className="text-xs text-slate-500">
              Dịch có kiểm soát, xem trước diff, không bao giờ tự động ghi đè mà chưa có xác nhận.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Configuration */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Ngôn ngữ nguồn (Source)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSourceChange('vi')}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                    sourceLocale === 'vi'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Tiếng Việt (VI)
                </button>
                <button
                  type="button"
                  onClick={() => handleSourceChange('en')}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                    sourceLocale === 'en'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  English (EN)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Ngôn ngữ đích (Target)
              </label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm font-semibold text-slate-700">
                {targetLocale === 'en' ? 'English (EN)' : 'Tiếng Việt (VI)'}
              </div>
            </div>
          </div>

          {/* Field Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
              Chọn các trường cần dịch
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALL_FIELDS.map((f) => (
                <label
                  key={f.id}
                  className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(f.id)}
                    onChange={() => toggleField(f.id)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action to preview */}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={loading || selectedFields.length === 0}
              onClick={() => void handlePreview()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Đang tạo bản dịch preview…' : 'Xem trước bản dịch (Preview)'}
            </button>
          </div>

          {/* Preview Results */}
          {preview && (
            <div className="space-y-4 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Kết quả xem trước (Diff Preview)</h3>
                <span className="text-xs text-slate-500">
                  Tổng: {preview.diffSummary.totalFields} trường | Mới:{' '}
                  {preview.diffSummary.newFields} | Ghi đè:{' '}
                  <strong
                    className={
                      preview.diffSummary.overwritingFields > 0
                        ? 'text-amber-600'
                        : 'text-slate-600'
                    }
                  >
                    {preview.diffSummary.overwritingFields}
                  </strong>
                </span>
              </div>

              <div className="space-y-3">
                {preview.fields.map((fieldDetail) => (
                  <div
                    key={fieldDetail.field}
                    className={`rounded-xl border p-4 transition-colors ${
                      fieldDetail.wouldOverwrite
                        ? 'border-amber-300 bg-amber-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <label className="flex items-center gap-2 font-semibold text-sm text-slate-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(chosenFields[fieldDetail.field])}
                          onChange={(e) =>
                            setChosenFields((prev) => ({
                              ...prev,
                              [fieldDetail.field]: e.target.checked,
                            }))
                          }
                          className="rounded text-indigo-600"
                        />
                        <span className="capitalize">{fieldDetail.field}</span>
                      </label>
                      {fieldDetail.wouldOverwrite ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                          Sẽ ghi đè nội dung hiện có
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                          Nội dung mới
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                      <div>
                        <span className="font-semibold text-slate-500">
                          Bản gốc ({preview.sourceLocale.toUpperCase()}):
                        </span>
                        <div className="mt-1 rounded bg-slate-50 p-2 text-slate-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {fieldDetail.sourceText || '(Trống)'}
                        </div>
                      </div>
                      <div>
                        <span className="font-semibold text-indigo-600">
                          Bản dịch đề xuất ({preview.targetLocale.toUpperCase()}):
                        </span>
                        <div className="mt-1 rounded bg-indigo-50/50 p-2 text-indigo-900 border border-indigo-100 max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {fieldDetail.proposedText || '(Trống)'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Overwrite confirmation */}
              {hasAnyOverwrite && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmOverwrite}
                      onChange={(e) => setConfirmOverwrite(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm font-semibold text-amber-900">
                      Tôi đồng ý ghi đè nội dung hiện có của các trường đích đã chọn.
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 bg-slate-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Hủy
          </button>
          {preview && (
            <button
              type="button"
              disabled={applying || (hasAnyOverwrite && !confirmOverwrite)}
              onClick={() => void handleApply()}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              {applying ? 'Đang áp dụng bản dịch…' : 'Áp dụng bản dịch (Apply)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
