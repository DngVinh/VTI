import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { IPublicQuestionService } from '../services/interfaces/IPublicQuestionService';
import { catchAsync } from '../utils/catchAsync';

@injectable()
export class PublicQuestionController {
  constructor(
    @inject('IPublicQuestionService')
    private publicQuestionService: IPublicQuestionService
  ) {}

  listPublicQuestions = catchAsync(async (req: Request, res: Response) => {
    const result = await this.publicQuestionService.listPublicQuestions(req.query as any);
    res.status(200).json({
      success: true,
      message: 'Lấy danh sách câu hỏi ôn tập thành công',
      data: result,
    });
  });

  getPublicQuestionDetail = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await this.publicQuestionService.getPublicQuestionDetail(id as string);
    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Câu hỏi không tồn tại hoặc chưa được xuất bản',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Lấy chi tiết câu hỏi ôn tập thành công',
      data: result,
    });
  });
}
