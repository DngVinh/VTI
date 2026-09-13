import { Link } from 'react-router-dom';
import type { QuestionSummaryDto } from '../types';
import { enumLabel } from './enumLabels';

const shortId = (value: string) => value.length > 10 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;

export const QuestionBankTable = ({ items }: { items: QuestionSummaryDto[] }) => (
  <div className="overflow-x-auto">
    <table aria-label="Danh sách câu hỏi" className="min-w-300 w-full border-collapse text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          {['Mã / nội dung', 'Taxonomy', 'Độ khó / loại', 'Lifecycle', 'Draft', 'Selection', 'Versions', 'Cập nhật'].map((heading) => (
            <th className="border-b border-slate-200 px-4 py-3 font-bold" key={heading} scope="col">{heading}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((question) => (
          <tr className="border-b border-slate-100 align-top hover:bg-indigo-50/30" key={question.id}>
            <td className="max-w-md px-4 py-4">
              <Link className="font-bold text-indigo-700 hover:underline" to={`/admin/question-bank/questions/${question.id}`}>{question.code}</Link>
              <p className="mt-1 line-clamp-2 text-slate-700">{question.promptPreview.vi || question.promptPreview.en || 'Chưa có prompt'}</p>
              {question.promptPreview.vi && question.promptPreview.en && <p className="mt-1 line-clamp-1 text-xs text-slate-500">EN: {question.promptPreview.en}</p>}
            </td>
            <td className="px-4 py-4 text-xs text-slate-600">
              <p>Role: {question.taxonomy.primaryRoleId ? shortId(question.taxonomy.primaryRoleId) : '—'}</p>
              <p>Levels: {question.taxonomy.levelIds.length}</p>
              <p>Tech: {question.taxonomy.technologyAgnostic ? 'Agnostic' : question.taxonomy.technologyIds.length}</p>
              <p>{question.taxonomy.topic || 'Chưa có topic'}</p>
            </td>
            <td className="px-4 py-4"><p>{enumLabel(question.difficulty)}</p><p className="text-xs text-slate-500">{enumLabel(question.type)}</p></td>
            <td className="px-4 py-4">{enumLabel(question.lifecycleStatus)}</td>
            <td className="px-4 py-4">{enumLabel(question.draftStatus)}</td>
            <td className="px-4 py-4">{enumLabel(question.selectionStatus)}</td>
            <td className="px-4 py-4 text-xs text-slate-600">
              <p>Latest: {question.latestVersionNumber}</p>
              <p>Draft: {question.draftVersionNumber ?? '—'}</p>
              <p>Published: {question.currentPublishedVersionNumber ?? '—'}</p>
            </td>
            <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">
              <time dateTime={question.updatedAt}>{new Date(question.updatedAt).toLocaleString('vi-VN')}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

