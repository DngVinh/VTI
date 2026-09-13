import type { SaveStatus } from '../types';

const LABELS: Record<SaveStatus, string> = {
  saved: 'Đã lưu',
  unsaved: 'Có thay đổi chưa lưu',
  saving: 'Đang lưu…',
  error: 'Lưu thất bại',
  conflict: 'Xung đột phiên bản',
};

export const SaveStatusIndicator = ({ status }: { status: SaveStatus }) => (
  <span aria-live="polite" className={`text-sm font-bold ${status === 'error' || status === 'conflict' ? 'text-red-700' : status === 'saved' ? 'text-emerald-700' : 'text-amber-700'}`} role="status">
    {LABELS[status]}
  </span>
);

