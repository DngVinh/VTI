import React from 'react';
import type { Question } from '../../InterviewRoom/types';

interface Props {
  questions: Question[];
  language: 'vi' | 'en';
}

export const FeedbackList: React.FC<Props> = ({ questions, language }) => {
  if (questions.length === 0) {
    return (
      <div className="text-slate-500 text-center">
        {language === 'vi' ? 'Không có câu hỏi nào.' : 'No questions found.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map((q, idx) => (
        <div key={q.id || q._id || idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-4">
          
          <div className="flex justify-between items-start gap-4">
            <h4 className="font-bold text-slate-800 text-lg">
              <span className="text-indigo-600 mr-2">{language === 'vi' ? 'Câu' : 'Question'} {idx + 1}:</span>
              {questions[idx]?.content?.[language] || questions[idx]?.content?.en || questions[idx]?.content?.vi || ''}
            </h4>
            <div className="flex-shrink-0 px-3 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-100">
              {q.score !== undefined ? `${q.score}/10` : 'N/A'}
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">{language === 'vi' ? 'Câu trả lời của bạn' : 'Your Answer'}</span>
            <p className="text-slate-700 whitespace-pre-wrap">{q.candidateAnswer || (language === 'vi' ? 'Không có câu trả lời' : 'No answer provided')}</p>
          </div>

          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 block">{language === 'vi' ? 'Nhận xét từ AI (Feedback)' : 'AI Feedback'}</span>
            <p className="text-emerald-900 whitespace-pre-wrap">{q.feedback?.[language] || q.feedback?.en || q.feedback?.vi || (language === 'vi' ? 'Không có nhận xét' : 'No feedback')}</p>
          </div>

        </div>
      ))}
    </div>
  );
};
