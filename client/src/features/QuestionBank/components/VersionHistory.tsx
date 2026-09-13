import { useEffect, useRef, useState } from 'react';
import type { ApiError } from '../../../auth/types';
import { questionBankApi } from '../api/questionBankApi';
import type { QuestionVersionAdminDetailDto, QuestionVersionSummaryDto } from '../types';
import { enumLabel } from './enumLabels';

export const VersionHistory = ({ questionId }: { questionId: string }) => {
  const [versions, setVersions] = useState<QuestionVersionSummaryDto[]>([]);
  const [selected, setSelected] = useState<QuestionVersionAdminDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const detailController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void questionBankApi.listVersions(questionId, controller.signal)
      .then(setVersions)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError((caught as ApiError).message || 'Không thể tải lịch sử.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [questionId]);

  const inspect = (versionNumber: number) => {
    detailController.current?.abort();
    const controller = new AbortController();
    detailController.current = controller;
    void questionBankApi.getVersion(questionId, versionNumber, controller.signal)
      .then(setSelected)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError((caught as ApiError).message || 'Không thể tải version.');
      });
  };

  return (
    <section aria-labelledby="version-history-heading" className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-extrabold text-slate-900" id="version-history-heading">Lịch sử version</h2>
      {loading && <p aria-live="polite" className="mt-3 text-sm text-slate-600" role="status">Đang tải lịch sử…</p>}
      {error && <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}
      {!loading && !error && versions.length === 0 && <p className="mt-3 text-sm text-slate-600">Chưa có version.</p>}
      <ol className="mt-3 divide-y divide-slate-100">
        {versions.map((version) => (
          <li className="flex items-center justify-between gap-3 py-3" key={version.id}>
            <div>
              <p className="font-bold text-slate-900">Version {version.versionNumber} · {enumLabel(version.status)}</p>
              <p className="text-xs text-slate-500">Revision {version.revision} · {new Date(version.updatedAt).toLocaleString('vi-VN')}</p>
            </div>
            <button className="rounded-lg border px-3 py-2 text-sm font-bold" onClick={() => inspect(version.versionNumber)} type="button">Xem chi tiết</button>
          </li>
        ))}
      </ol>
      {selected && (
        <article className="mt-4 rounded-xl bg-slate-50 p-4">
          <h3 className="font-extrabold">Version {selected.versionNumber}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm"><strong>Prompt VI:</strong> {selected.content.prompt.vi || '—'}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm"><strong>Prompt EN:</strong> {selected.content.prompt.en || '—'}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm"><strong>Reference answer VI:</strong> {selected.answer.referenceAnswer.vi || '—'}</p>
          <p className="mt-2 text-sm"><strong>Rubric:</strong> {selected.rubric.length} tiêu chí</p>
        </article>
      )}
      <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
        <strong>Review và audit timeline:</strong> Chưa khả dụng trong Phase 1.
      </div>
    </section>
  );
};
