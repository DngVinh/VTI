import React from 'react';
import type { InterviewSession } from '../../InterviewRoom/types';

interface Props {
  learningPath: InterviewSession['learningPath'];
  language: 'vi' | 'en';
}

export const LearningPathView: React.FC<Props> = ({ learningPath, language }) => {
  if (!learningPath || learningPath.length === 0) {
    return null;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPriorityLabel = (priority: string, lang: 'vi' | 'en') => {
    if (lang === 'en') {
      switch (priority.toLowerCase()) {
        case 'high': return 'High';
        case 'medium': return 'Medium';
        case 'low': return 'Low';
        default: return priority;
      }
    }
    switch (priority.toLowerCase()) {
      case 'high': return 'Cao';
      case 'medium': return 'Trung bình';
      case 'low': return 'Thấp';
      default: return priority;
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <h3 className="text-xl font-bold text-slate-800">
          {language === 'vi' ? 'Lộ trình học tập đề xuất' : 'Recommended Learning Path'}
        </h3>
      </div>

      <div className="space-y-4">
        {learningPath.map((item, idx) => (
          <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-colors">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h4 className="font-bold text-slate-800 text-lg">{item.topic[language] || item.topic.en || item.topic.vi}</h4>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${getPriorityColor(item.priority)}`}>
                  {language === 'vi' ? 'Ưu tiên' : 'Priority'}: {getPriorityLabel(item.priority, language)}
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed">{item.suggestion[language] || item.suggestion.en || item.suggestion.vi}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
