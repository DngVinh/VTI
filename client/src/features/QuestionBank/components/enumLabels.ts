const LABELS: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  RETIRED: 'Đã retire',
  DRAFT: 'Bản nháp',
  IN_REVIEW: 'Đang review',
  APPROVED: 'Đã duyệt',
  PUBLISHED: 'Đã publish',
  SUPERSEDED: 'Đã thay thế',
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
  MANUAL: 'Biên soạn thủ công',
  AI_ASSISTED: 'Hỗ trợ bởi AI',
  IMPORTED: 'Import từ tệp',
  TECHNICAL: 'Kỹ thuật',
  BEHAVIORAL: 'Hành vi',
  SCENARIO: 'Tình huống',
  CODING: 'Lập trình',
  SYSTEM_DESIGN: 'Thiết kế hệ thống',
  PUBLISHED_SELECTION: 'Có thể tuyển chọn',
  UNAVAILABLE: 'Chưa thể tuyển chọn',
};

export const enumLabel = (value: string | null | undefined): string => {
  if (!value) return '—';
  return LABELS[value] ?? `Không xác định (${value})`;
};

