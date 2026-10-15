import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { InterviewAnalyticsSeriesPoint } from '../../services/api/interviewApi';
import {
  DIMENSIONS,
  DIMENSION_LABELS,
  DIMENSION_COLORS,
} from './constants';

interface Props {
  series: InterviewAnalyticsSeriesPoint[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-xl backdrop-blur-md text-xs">
      <div className="mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-1.5 font-bold text-slate-800">
        <svg aria-hidden="true" className="h-3.5 w-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Ngày {label}
      </div>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {DIMENSION_LABELS[entry.name] ?? entry.name}
            </span>
            <span className="font-extrabold text-slate-900">
              {typeof entry.value === 'number' ? `${entry.value.toFixed(1)} / 10` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AnalyticsChart = ({ series }: Props) => {
  const [viewMode, setViewMode] = useState<'all' | 'overall'>('all');

  const chartData = useMemo(
    () =>
      series.map((point) => {
        const dimensions = Object.fromEntries(
          point.dimensions.map((dimension) => [
            dimension.name,
            dimension.score,
          ])
        );

        return {
          date: point.date,
          overall: point.overallScore,
          ...dimensions,
        };
      }),
    [series]
  );

  return (
    <div
      className="w-full space-y-4"
      aria-label="Biểu đồ xu hướng điểm phỏng vấn theo thời gian"
    >
      {/* Chart View Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              viewMode === 'all'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả tiêu chí
          </button>
          <button
            type="button"
            onClick={() => setViewMode('overall')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              viewMode === 'overall'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chỉ xem Điểm Tổng Thể
          </button>
        </div>

        <p className="text-xs text-slate-500 font-medium">
          Mẹo: Rê chuột lên các điểm tròn để xem chi tiết từng tiêu chí
        </p>
      </div>

      <div className="h-80 w-full sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 10,
              right: 12,
              left: 0,
              bottom: 8,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />

            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#64748b' }}
              stroke="#cbd5e1"
            />

            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 12, fill: '#64748b' }}
              stroke="#cbd5e1"
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              formatter={(value) => DIMENSION_LABELS[value] ?? value}
              wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
            />

            <Line
              type="monotone"
              dataKey="overall"
              name="overall"
              stroke={DIMENSION_COLORS.overall}
              strokeWidth={viewMode === 'overall' ? 3.5 : 2.5}
              dot={{ r: 4, fill: DIMENSION_COLORS.overall, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6 }}
            />

            {viewMode === 'all' &&
              DIMENSIONS.map((name) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stroke={DIMENSION_COLORS[name]}
                  strokeWidth={1.8}
                  strokeDasharray={name === 'Communication' ? '4 4' : undefined}
                  dot={{ r: 3, fill: DIMENSION_COLORS[name], strokeWidth: 1.5, stroke: '#fff' }}
                  activeDot={{ r: 5 }}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Accessible Table for Screen Readers & Tests */}
      <table className="sr-only">
        <caption>
          Dữ liệu xu hướng điểm theo ngày
        </caption>

        <thead>
          <tr>
            <th>Ngày</th>
            <th>Tổng thể</th>

            {DIMENSIONS.map((name) => (
              <th key={name}>{DIMENSION_LABELS[name]}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {series.map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{point.overallScore}</td>

              {DIMENSIONS.map((name) => (
                <td key={name}>
                  {point.dimensions.find(
                    (dimension) => dimension.name === name
                  )?.score ?? 'Không có dữ liệu'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

