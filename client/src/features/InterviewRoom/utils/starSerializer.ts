import type { StarData } from '../types';

/** Ghép StarData thành string chuẩn để gửi lên backend */
export const serializeStarData = (data: StarData): string => {
  const parts: string[] = [];
  if (data.situation.trim()) parts.push(`[Situation] ${data.situation.trim()}`);
  if (data.task.trim()) parts.push(`[Task] ${data.task.trim()}`);
  if (data.action.trim()) parts.push(`[Action] ${data.action.trim()}`);
  if (data.result.trim()) parts.push(`[Result] ${data.result.trim()}`);
  return parts.join('\n\n');
};
