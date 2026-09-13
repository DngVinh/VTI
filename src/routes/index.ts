import { Router } from 'express';

import roleRoutes from './role.route';
import levelRoutes from './level.route';
import technologyRoutes from './technology.route';
import interviewRoutes from './interview.route';
import authRoutes from './auth.routes';
import profileRoutes from './profile.routes';
import adminUserRoutes from './admin-user.route';
import adminSystemPromptRoutes from './admin-system-prompt.route';
import adminMetricsRoutes from './admin-metrics.route';
import questionBankRoutes from './question-bank.route';
import publicQuestionRoutes from './public-question.route';

const router = Router();

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/roles', roleRoutes);
router.use('/levels', levelRoutes);
router.use('/technologies', technologyRoutes);
router.use('/interviews', interviewRoutes);
router.use('/questions', publicQuestionRoutes);

router.use('/admin', adminMetricsRoutes);
router.use('/admin', adminUserRoutes);
router.use('/admin/prompts', adminSystemPromptRoutes);
router.use('/admin/question-bank', questionBankRoutes);

export default router;
