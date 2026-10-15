import { Link } from 'react-router-dom';
import type { QuestionSummaryDto } from '../types';
import { enumLabel } from './enumLabels';

const badgeClass = (value: string | null | undefined) => {
  if (value === 'ACTIVE' || value === 'PUBLISHED') return 'bg-emerald-50 text-emerald-700';
  if (value === 'RETIRED' || value === 'SUPERSEDED') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-50 text-amber-700';
};

const Badge = ({ value }: { value: string | null | undefined }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass(value)}`}>
    {enumLabel(value)}
  </span>
);

interface QuestionBankTableProps {
  items: QuestionSummaryDto[];
  onLifecycleChange?: (question: QuestionSummaryDto) => void;
  busyQuestionId?: string | null;
}

export const QuestionBankTable = ({
  items,
  onLifecycleChange,
  busyQuestionId,
}: QuestionBankTableProps) => (
  <div className="overflow-x-auto">
    <table aria-label="Danh sách câu hỏi" className="min-w-[760px] w-full border-collapse text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          {['Câu hỏi', 'Phân loại', 'Trạng thái', 'Cập nhật', ''].map((heading) => (
            <th className="border-b border-slate-200 px-4 py-3 font-bold" key={heading} scope="col">{heading}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((question) => (
          <tr className="border-b border-slate-100 align-top hover:bg-indigo-50/30" key={question.id}>
            <td className="max-w-lg px-4 py-4">
              <Link className="font-bold text-indigo-700 hover:underline" to={`/admin/question-bank/questions/${question.id}`}>
                {question.code}
              </Link>
              <p className="mt-1 line-clamp-2 leading-6 text-slate-700">
                {question.promptPreview.vi || question.promptPreview.en || 'Chưa có nội dung câu hỏi'}
              </p>
              {question.promptPreview.vi && question.promptPreview.en && (
                <p className="mt-1 line-clamp-1 text-xs text-slate-500">EN: {question.promptPreview.en}</p>
              )}
            </td>
            <td className="px-4 py-4 text-slate-600">
              <p className="font-semibold text-slate-800">{enumLabel(question.type)}</p>
              <p className="mt-1 text-xs">Độ khó: {enumLabel(question.difficulty)}</p>
              <p className="mt-2 text-xs">{question.taxonomy.topic || 'Chưa có topic'}</p>
              {question.taxonomy.tags.length > 0 && (
                <p className="mt-1 line-clamp-1 text-xs text-slate-500">#{question.taxonomy.tags.join(' #')}</p>
              )}
            </td>
            <td className="px-4 py-4">
              <div className="flex flex-col items-start gap-2">
                <Badge value={question.lifecycleStatus} />
                <Badge value={question.draftStatus} />
              </div>
            </td>
            <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">
              <time dateTime={question.updatedAt}>{new Date(question.updatedAt).toLocaleString('vi-VN')}</time>
              <p className="mt-1">v{question.latestVersionNumber}</p>
            </td>
            <td className="whitespace-nowrap px-4 py-4 text-right">
              <div className="flex flex-col items-end gap-2">
                <Link
                  aria-label={`Mở ${question.code}`}
                  className="rounded-lg border border-indigo-200 px-3 py-2 font-bold text-indigo-700 hover:bg-indigo-50"
                  to={`/admin/question-bank/questions/${question.id}/edit`}
                >
                  Mở
                </Link>
                {onLifecycleChange && (
                  <button
                    aria-label={question.lifecycleStatus === 'ACTIVE' ? `Ẩn ${question.code}` : `Khôi phục ${question.code}`}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"
                    disabled={busyQuestionId === question.id}
                    onClick={() => onLifecycleChange(question)}
                    type="button"
                  >
                    {busyQuestionId === question.id
                      ? 'Đang xử lý…'
                      : question.lifecycleStatus === 'ACTIVE' ? 'Ẩn khỏi thư viện' : 'Khôi phục'}
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

