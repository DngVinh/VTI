import React from 'react';

interface QuestionNavigatorProps {
  totalQuestions: number;
  currentIndex: number;
  onSelectQuestion: (index: number) => void;
  answeredIndices: Set<number>;
  language?: 'vi' | 'en';
}

export const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  totalQuestions,
  currentIndex,
  onSelectQuestion,
  answeredIndices,
  language = 'vi',
}) => {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        onSelectQuestion(Math.min(totalQuestions - 1, index + 1));
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        onSelectQuestion(Math.max(0, index - 1));
        break;
      case 'Home':
        e.preventDefault();
        onSelectQuestion(0);
        break;
      case 'End':
        e.preventDefault();
        onSelectQuestion(totalQuestions - 1);
        break;
    }
  };

  const navLabel = language === 'en' ? 'Question list' : 'Danh sách câu hỏi';

  const safeCount = Math.max(0, Math.floor(totalQuestions || 0));

  return (
    <nav aria-label={navLabel} className="flex flex-wrap gap-2">
      {Array.from({ length: safeCount }).map((_, index) => {
        const isCurrent = index === currentIndex;
        const isAnswered = answeredIndices.has(index);

        let baseClass =
          'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-200 border-2 outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 cursor-pointer ';

        if (isCurrent) {
          baseClass +=
            'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-110 z-10';
        } else if (isAnswered) {
          baseClass +=
            'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:border-emerald-700';
        } else {
          baseClass +=
            'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400';
        }

        const ariaLabel =
          language === 'en'
            ? `Question ${index + 1}${isAnswered ? ' (Answered)' : ''}`
            : `Câu hỏi ${index + 1}${isAnswered ? ' (Đã trả lời)' : ''}`;

        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelectQuestion(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={baseClass}
            aria-label={ariaLabel}
            aria-current={isCurrent ? 'step' : undefined}
          >
            {index + 1}
          </button>
        );
      })}
    </nav>
  );
};
