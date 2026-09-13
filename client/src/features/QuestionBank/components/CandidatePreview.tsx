import type { LocalizedText, QuestionClassification } from '../types';
import { enumLabel } from './enumLabels';

interface Props {
  prompt: LocalizedText;
  classification: QuestionClassification;
}

export const CandidatePreview = ({ prompt, classification }: Props) => (
  <section aria-labelledby="candidate-preview-heading" className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
    <h2 className="text-lg font-extrabold text-cyan-950" id="candidate-preview-heading">Preview cho Candidate</h2>
    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-cyan-800">Chỉ prompt và metadata được phép hiển thị</p>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div><h3 className="font-bold text-slate-900">Tiếng Việt</h3><p className="mt-1 whitespace-pre-wrap text-slate-800">{prompt.vi || 'Chưa có prompt'}</p></div>
      <div><h3 className="font-bold text-slate-900">English</h3><p className="mt-1 whitespace-pre-wrap text-slate-800">{prompt.en || 'No prompt yet'}</p></div>
    </div>
    <dl className="mt-4 flex flex-wrap gap-3 text-sm">
      <div><dt className="inline font-bold">Loại: </dt><dd className="inline">{enumLabel(classification.type)}</dd></div>
      <div><dt className="inline font-bold">Độ khó: </dt><dd className="inline">{enumLabel(classification.difficulty)}</dd></div>
      <div><dt className="inline font-bold">Topic: </dt><dd className="inline">{classification.topic || '—'}</dd></div>
      <div><dt className="inline font-bold">Tags: </dt><dd className="inline">{classification.tags.join(', ') || '—'}</dd></div>
    </dl>
  </section>
);

