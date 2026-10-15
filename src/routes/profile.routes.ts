import { Router } from 'express';
import { getProfileHandler, updateProfileHandler, uploadAvatarHandler } from '../controllers/profile.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { updateProfileSchema } from '../validators/profile.validator';
import { uploadAvatarMiddleware } from '../middlewares/upload.middleware';
import { catchAsync } from '../utils/catchAsync';

const router = Router();

router.get('/', authenticate, catchAsync(getProfileHandler));
router.patch('/', authenticate, validate(updateProfileSchema), catchAsync(updateProfileHandler));
router.post('/avatar', authenticate, uploadAvatarMiddleware.single('avatar'), catchAsync(uploadAvatarHandler));

export default router;