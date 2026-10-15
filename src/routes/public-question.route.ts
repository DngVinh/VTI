import { Router } from 'express';
import { container } from 'tsyringe';
import { PublicQuestionController } from '../controllers/public-question.controller';
import { validate } from '../middlewares/validate.middleware';
import {
  getPublicQuestionDetailSchema,
  listPublicQuestionsSchema,
} from '../validators/public-question.validator';

const router = Router();
const controller = container.resolve(PublicQuestionController);

// Primary endpoints according to spec
router.get('/public', validate(listPublicQuestionsSchema), controller.listPublicQuestions);
router.get('/public/taxonomy', controller.getPublicTaxonomy);
router.get('/public/:id', validate(getPublicQuestionDetailSchema), controller.getPublicQuestionDetail);

// Convenience aliases for /api/v1/questions and /api/v1/questions/:id
router.get('/taxonomy', controller.getPublicTaxonomy);
router.get('/', validate(listPublicQuestionsSchema), controller.listPublicQuestions);
router.get('/:id', validate(getPublicQuestionDetailSchema), controller.getPublicQuestionDetail);

export default router;
