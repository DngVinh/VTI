import { AppError } from '../../../utils/AppError';
import { normalizePromptFingerprint } from '../../question-bank/hashing';
import { CandidateQuestionPayload, INTERVIEW_SOURCE_ERROR_CODES } from './types';

export class InterviewQuestionBundleValidator {
  private static readonly ALLOWED_DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD']);

  public static validate(questions: CandidateQuestionPayload[]): void {
    if (!Array.isArray(questions) || questions.length !== 5) {
      throw new AppError(
        `Bundle câu hỏi phỏng vấn phải chứa chính xác 5 câu hỏi (hiện có ${questions?.length ?? 0})`,
        400,
        INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID
      );
    }

    // 1. Verify orders: must be exactly [1, 2, 3, 4, 5]
    const orders = questions.map((q) => q.order).sort((a, b) => a - b);
    for (let i = 0; i < 5; i++) {
      if (orders[i] !== i + 1) {
        throw new AppError(
          `Thứ tự câu hỏi trong bundle phải liên tục từ 1 đến 5 không trùng lặp`,
          400,
          INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID
        );
      }
    }

    // 2. Verify bilingual content, valid difficulty, deduplication, and provenance
    const seenFingerprints = new Set<string>();

    for (const q of questions) {
      // Content checks
      const vi = q.content?.vi?.trim();
      const en = q.content?.en?.trim();
      if (!vi || !en) {
        throw new AppError(
          `Câu hỏi thứ ${q.order} thiếu nội dung tiếng Việt hoặc tiếng Anh`,
          400,
          INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID
        );
      }

      // Difficulty normalization / check
      const normalizedDifficulty = q.difficulty?.toUpperCase();
      if (!normalizedDifficulty || !this.ALLOWED_DIFFICULTIES.has(normalizedDifficulty)) {
        throw new AppError(
          `Câu hỏi thứ ${q.order} có độ khó không hợp lệ: ${q.difficulty}`,
          400,
          INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID
        );
      }

      // Prompt fingerprint deduplication
      const fingerprint = normalizePromptFingerprint({ vi, en });
      if (!fingerprint) {
        throw new AppError(
          `Không thể tạo fingerprint cho nội dung câu hỏi thứ ${q.order}`,
          400,
          INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID
        );
      }

      if (seenFingerprints.has(fingerprint)) {
        throw new AppError(
          `Phát hiện câu hỏi trùng lặp nội dung trong bundle tại vị trí thứ ${q.order}`,
          400,
          INTERVIEW_SOURCE_ERROR_CODES.DUPLICATE
        );
      }
      seenFingerprints.add(fingerprint);

      // Provenance checks
      if (q.sourceType === 'QUESTION_BANK') {
        if (!q.questionBankQuestionId || !q.questionBankVersionId) {
          throw new AppError(
            `Câu hỏi Question Bank thứ ${q.order} thiếu questionBankQuestionId hoặc questionBankVersionId`,
            400,
            INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID
          );
        }
      } else if (q.sourceType === 'AI_GENERATED') {
        if (q.questionBankQuestionId || q.questionBankVersionId) {
          throw new AppError(
            `Câu hỏi AI thứ ${q.order} không được chứa Question Bank IDs`,
            400,
            INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID
          );
        }
      } else {
        throw new AppError(
          `Câu hỏi thứ ${q.order} có sourceType không hợp lệ: ${q.sourceType}`,
          400,
          INTERVIEW_SOURCE_ERROR_CODES.BUNDLE_INVALID
        );
      }
    }
  }
}
