import multer from 'multer';
import { AppError } from '../utils/AppError';
import { extname, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

// Use memory storage so we don't save files to disk
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
    fields: 6,
    parts: 8,
    fieldSize: 4096,
  },
  fileFilter: (req, file, cb) => {
    const types: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    if (types[extname(file.originalname).toLowerCase()] === file.mimetype) {
      cb(null, true);
    } else {
      cb(new AppError('Only PDF and DOCX files are allowed.', 415, 'UNSUPPORTED_FILE_TYPE'));
    }
  },
});

const avatarUploadDir = join(process.cwd(), 'uploads', 'avatars');
if (!existsSync(avatarUploadDir)) {
  mkdirSync(avatarUploadDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!existsSync(avatarUploadDir)) {
      mkdirSync(avatarUploadDir, { recursive: true });
    }
    cb(null, avatarUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.png';
    const userId = req.user?._id?.toString() || 'user';
    cb(null, `avatar-${userId}-${Date.now()}${ext}`);
  },
});

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export const uploadAvatarMiddleware = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const expectedMime = ALLOWED_IMAGE_TYPES[ext];
    if (expectedMime && (file.mimetype === expectedMime || file.mimetype.startsWith('image/'))) {
      cb(null, true);
    } else {
      cb(new AppError('Chỉ chấp nhận các tệp ảnh định dạng JPG, PNG, WEBP hoặc GIF.', 400, 'UNSUPPORTED_FILE_TYPE'));
    }
  },
});

