import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import type { ISandboxProvider } from '../services/code-sandbox/types';
import { codeExecutionRequestSchema } from '../services/code-sandbox/types';
import { AiCodeReviewer } from '../services/code-sandbox/AiCodeReviewer';
import { ComplexityAnalyzer } from '../services/code-sandbox/ComplexityAnalyzer';

@injectable()
export class CodeExecutionController {
  private readonly aiReviewer: AiCodeReviewer;

  constructor(
    @inject('ISandboxProvider') private readonly sandboxProvider: ISandboxProvider,
    @inject(AiCodeReviewer) aiReviewer?: AiCodeReviewer
  ) {
    this.aiReviewer = aiReviewer || new AiCodeReviewer(new ComplexityAnalyzer());
  }

  executeCode = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const parsed = codeExecutionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message || 'Dữ liệu thực thi mã nguồn không hợp lệ',
        400,
        'AIU_SANDBOX_INVALID_PAYLOAD'
      );
    }

    const { questionId, code, language, testCases } = parsed.data;
    const withAiReview = Boolean(req.body?.withAiReview);

    const execution = await this.sandboxProvider.execute(
      code,
      language,
      testCases
    );

    let review = undefined;
    if (withAiReview && this.aiReviewer) {
      review = await this.aiReviewer.review({
        code,
        language,
        questionContext: questionId,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        execution,
        ...(review ? { review } : {}),
      },
    });
  });
}
