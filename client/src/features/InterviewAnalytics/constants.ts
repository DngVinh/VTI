export const DIMENSIONS = [
  'Technical Depth',
  'Problem Solving',
  'System Design & Best Practices',
  'Communication',
  'Practical Experience',
] as const;

export type DimensionName = typeof DIMENSIONS[number];

export const DIMENSION_LABELS: Record<string, string> = {
  overall: 'Tổng thể',
  'Technical Depth': 'Chuyên môn',
  'Problem Solving': 'Giải quyết vấn đề',
  'System Design & Best Practices': 'Thiết kế hệ thống',
  Communication: 'Giao tiếp',
  'Practical Experience': 'Thực chiến',
};

export const DIMENSION_COLORS: Record<string, string> = {
  overall: '#4f46e5',
  'Technical Depth': '#7c3aed',
  'Problem Solving': '#059669',
  'System Design & Best Practices': '#d97706',
  Communication: '#dc2626',
  'Practical Experience': '#0891b2',
};
