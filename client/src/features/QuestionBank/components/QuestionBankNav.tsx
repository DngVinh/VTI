import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/admin/question-bank', label: 'Ngân hàng câu hỏi', end: true },
  { to: '/admin/question-bank/reviews', label: 'Hàng đợi duyệt' },
  { to: '/admin/question-bank/selection', label: 'Mô phỏng chọn câu' },
  { to: '/admin/question-bank/analytics', label: 'Độ phủ & Thống kê' },
  { to: '/admin/question-bank/import-export', label: 'Import / Export' },
  { to: '/admin/question-bank/ai-assistant', label: 'AI Assistant' },
];

export const QuestionBankNav = () => {
  return (
    <nav aria-label="Question Bank Sections" className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
};
