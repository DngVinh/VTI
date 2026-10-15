import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { InterviewSession } from '../../InterviewRoom/types';

interface Props {
  dimensions: NonNullable<InterviewSession['dimensions']>;
  language: 'vi' | 'en';
}

export const RadarScoreChart: React.FC<Props> = ({ dimensions, language }) => {
  const chartData = useMemo(() => {
    const translations: Record<string, string> = {
      // Legacy DIMENSIONS
      'TECHNICAL_ACCURACY': 'Chính xác Kỹ thuật',
      'PROBLEM_SOLVING': 'Giải quyết Vấn đề',
      'COMMUNICATION': 'Giao tiếp',
      'PRACTICAL_APPLICATION': 'Ứng dụng Thực tế',
      // Standard v2
      'Technical Depth': 'Chuyên môn',
      'Problem Solving': 'Giải quyết vấn đề',
      'System Design & Best Practices': 'Thiết kế Hệ thống',
      'Communication': 'Giao tiếp',
      'Practical Experience': 'Thực chiến',
      // Multi-Agent calibrated dimensions
      'Technical Accuracy & Architecture': 'Kiến trúc & Độ chính xác',
      'Code Quality & Clean Design': 'Chất lượng Mã nguồn',
      'Security & Edge Case Handling': 'Bảo mật & Xử lý Biên',
      'Communication & Problem Solving': 'Giao tiếp & Giải quyết Vấn đề',
    };

    return dimensions.map(d => {
      let reasoningText = '';
      if (typeof d.reasoning === 'string') {
        reasoningText = d.reasoning;
      } else if (d.reasoning && typeof d.reasoning === 'object') {
        const localized = d.reasoning as { vi?: string; en?: string };
        reasoningText = localized[language] || localized.en || localized.vi || '';
      }
      return {
        subject: language === 'vi' ? (translations[d.name] || d.name) : d.name,
        score: d.score,
        fullMark: 10,
        reasoning: reasoningText,
      };
    });
  }, [dimensions, language]);

  if (chartData.length === 0) {
    return (
      <div className="text-slate-500 text-center py-8">
        {language === 'vi' ? 'Chưa có dữ liệu đánh giá' : 'No evaluation data available'}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      <div className="w-full h-72 md:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 13, fontWeight: 500 }} />
            <PolarRadiusAxis angle={30} domain={[0, 10]} />
            <Tooltip 
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [
                `${value} / 10`,
                language === 'vi' ? 'Điểm trung bình' : 'Average score',
              ]} 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Radar
              name={language === 'vi' ? 'Ứng viên' : 'Candidate'}
              dataKey="score"
              stroke="#6366f1"
              fill="#818cf8"
              fillOpacity={0.6}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {chartData.some(d => Boolean(d.reasoning)) && (
        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
          {chartData.map((d, i) => d.reasoning ? (
            <div key={i} className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{d.subject} ({d.score}/10): </span>
              <span>{d.reasoning}</span>
            </div>
          ) : null)}
        </div>
      )}
    </div>
  );
};
