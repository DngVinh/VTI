import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Hoist test environment variables before any module is evaluated
vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_key_at_least_32_characters_long_12345';
  process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_at_least_32_characters_long_67890';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
});

import app from '../src/app';
import User from '../src/models/user.model';
import RefreshToken from '../src/models/refresh-token.model';
import { ApiRateLimitModel } from '../src/models/api-rate-limit.model';
import { getEnv } from '../src/config/env';
import { generateAuthTokens, verifyAccessToken, verifyRefreshToken, hashToken } from '../src/utils/token';
import { JwtTokenPayload } from '../src/types/auth.type';

let mongoReplSet: MongoMemoryReplSet;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongoReplSet.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoReplSet.stop();
});

beforeEach(async () => {
  // Restore standard test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_key_at_least_32_characters_long_12345';
  process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_at_least_32_characters_long_67890';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';

  await User.deleteMany({});
  await RefreshToken.deleteMany({});
  await ApiRateLimitModel.deleteMany({});
});

describe('AIP-15 & AIP-16: Authentication & Session Management Tests', () => {
  // =================================================================
  // 1. CONFIGURATION & ENVIRONMENT VALIDATION TESTS
  // =================================================================
  describe('Environment Configuration Validation (getEnv)', () => {
    it('1.1 getEnv: Trả về config hợp lệ khi đầy đủ biến môi trường hợp lệ', () => {
      const config = getEnv();
      expect(config.JWT_ACCESS_SECRET).toBe('test_jwt_access_secret_key_at_least_32_characters_long_12345');
      expect(config.JWT_REFRESH_SECRET).toBe('test_jwt_refresh_secret_key_at_least_32_characters_long_67890');
      expect(config.JWT_ACCESS_EXPIRES_IN).toBe('15m');
      expect(config.JWT_REFRESH_EXPIRES_IN).toBe('7d');
      expect(config.BCRYPT_SALT_ROUNDS).toBe(10);
    });

    it('1.2 getEnv: Từ chối khi thiếu JWT_ACCESS_SECRET (không fallback)', () => {
      delete process.env.JWT_ACCESS_SECRET;
      expect(() => getEnv()).toThrow(/JWT_ACCESS_SECRET/);
    });

    it('1.3 getEnv: Từ chối khi thiếu JWT_REFRESH_SECRET (không fallback)', () => {
      delete process.env.JWT_REFRESH_SECRET;
      expect(() => getEnv()).toThrow(/JWT_REFRESH_SECRET/);
    });

    it('1.4 getEnv: Từ chối khi JWT_ACCESS_SECRET ngắn hơn 32 ký tự', () => {
      process.env.JWT_ACCESS_SECRET = 'short-secret';
      expect(() => getEnv()).toThrow(/at least 32 characters/);
    });

    it('1.5 getEnv: Từ chối khi hai secret giống nhau', () => {
      const sameSecret = 'same_secret_key_with_at_least_32_characters_long_123456789';
      process.env.JWT_ACCESS_SECRET = sameSecret;
      process.env.JWT_REFRESH_SECRET = sameSecret;
      expect(() => getEnv()).toThrow(/must be different/);
    });

    it('1.6 getEnv: Từ chối khi JWT expiration không hợp lệ', () => {
      process.env.JWT_ACCESS_EXPIRES_IN = 'invalid_duration';
      expect(() => getEnv()).toThrow(/JWT_ACCESS_EXPIRES_IN/);
    });

    it('1.7 getEnv: Từ chối khi BCRYPT_SALT_ROUNDS ngoài phạm vi an toàn (10-14)', () => {
      process.env.BCRYPT_SALT_ROUNDS = '30';
      expect(() => getEnv()).toThrow(/BCRYPT_SALT_ROUNDS/);

      process.env.BCRYPT_SALT_ROUNDS = '5';
      expect(() => getEnv()).toThrow(/BCRYPT_SALT_ROUNDS/);
    });

    it('1.8 getEnv: Từ chối placeholder secret trong môi trường production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_ACCESS_SECRET = 'replace-with-at-least-32-random-characters';
      process.env.JWT_REFRESH_SECRET = 'a_valid_production_refresh_secret_at_least_32_chars';
      expect(() => getEnv()).toThrow(/placeholder/);
    });
  });

  // =================================================================
  // 2. JWT TOKEN GENERATION & VERIFICATION TESTS
  // =================================================================
  describe('JWT Token Utilities (src/utils/token.ts)', () => {
    it('2.1 verifyAccessToken xác thực thành công access token với HS256', () => {
      const tokens = generateAuthTokens('user-123', 'CANDIDATE');
      const payload = verifyAccessToken(tokens.accessToken);

      expect(payload.sub).toBe('user-123');
      expect(payload.role).toBe('CANDIDATE');
      expect(payload.type).toBe('access');
    });

    it('2.2 verifyRefreshToken xác thực thành công refresh token với HS256', () => {
      const tokens = generateAuthTokens('user-123', 'ADMIN');
      const payload = verifyRefreshToken(tokens.refreshToken);

      expect(payload.sub).toBe('user-123');
      expect(payload.role).toBe('ADMIN');
      expect(payload.type).toBe('refresh');
      expect(payload.jti).toBeDefined();
      expect(payload.sessionId).toBeDefined();
    });

    it('2.3 verifyAccessToken từ chối refresh token (sai type và sai secret)', () => {
      const tokens = generateAuthTokens('user-123', 'CANDIDATE');
      expect(() => verifyAccessToken(tokens.refreshToken)).toThrow();
    });

    it('2.4 verifyRefreshToken từ chối access token (sai type và sai secret)', () => {
      const tokens = generateAuthTokens('user-123', 'CANDIDATE');
      expect(() => verifyRefreshToken(tokens.accessToken)).toThrow();
    });

    it('2.5 verifyAccessToken từ chối token có type không phải access dù dùng đúng access secret', () => {
      const fakeToken = jwt.sign(
        { sub: 'user-123', role: 'CANDIDATE', type: 'refresh' },
        process.env.JWT_ACCESS_SECRET!,
        { algorithm: 'HS256' }
      );
      expect(() => verifyAccessToken(fakeToken)).toThrow(/Invalid access token payload/);
    });

    it('2.6 hashToken băm token chuẩn xác bằng SHA256', () => {
      const token = 'sample-refresh-token';
      const hash = hashToken(token);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
      expect(hashToken(token)).toBe(hash);
    });

    it('2.7 verifyAccessToken và verifyRefreshToken giữ nguyên credentialVersion claim', () => {
      const tokens = generateAuthTokens('user-123', 'ADMIN', undefined, undefined, 3);
      const accessPayload = verifyAccessToken(tokens.accessToken);
      const refreshPayload = verifyRefreshToken(tokens.refreshToken);

      expect(accessPayload.credentialVersion).toBe(3);
      expect(refreshPayload.credentialVersion).toBe(3);
    });

    it('2.8 verifyAccessToken từ chối token thiếu credentialVersion hoặc có giá trị âm', () => {
      const missingCred = jwt.sign(
        { sub: 'user-123', role: 'CANDIDATE', type: 'access' },
        process.env.JWT_ACCESS_SECRET!,
        { algorithm: 'HS256' }
      );
      expect(() => verifyAccessToken(missingCred)).toThrow(/Invalid access token payload/);

      const negativeCred = jwt.sign(
        { sub: 'user-123', role: 'CANDIDATE', type: 'access', credentialVersion: -1 },
        process.env.JWT_ACCESS_SECRET!,
        { algorithm: 'HS256' }
      );
      expect(() => verifyAccessToken(negativeCred)).toThrow(/Invalid access token payload/);
    });

    it('2.9 verifyRefreshToken từ chối token thiếu credentialVersion hoặc có giá trị không hợp lệ', () => {
      const invalidCred = jwt.sign(
        { sub: 'user-123', role: 'ADMIN', type: 'refresh', jti: 'jti-1', sessionId: 'sess-1', credentialVersion: 'zero' },
        process.env.JWT_REFRESH_SECRET!,
        { algorithm: 'HS256' }
      );
      expect(() => verifyRefreshToken(invalidCred)).toThrow(/Invalid refresh token payload/);
    });
  });

  // =================================================================
  // 3. HEALTH CHECK & 404 INTEGRITY
  // =================================================================
  describe('System Integrity Routes', () => {
    it('GET /health: Hoạt động bình thường không bị ảnh hưởng', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('IT Interview AI API is running');
    });

    it('GET /api/unknown-route: Trả về 404 AppError qua globalErrorHandler', async () => {
      const res = await request(app).get('/api/unknown-route');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  // =================================================================
  // 4. REGISTER HỢP LỆ & DUPLICATE
  // =================================================================
  describe('POST /api/v1/auth/register', () => {
    it('4.1 Đăng ký thành công: trả về 201, đúng message tiếng Việt UTF-8, lưu đúng 1 user, hash password, trả SafeUser và lưu RefreshToken hash', async () => {
      const payload = {
        email: 'candidate@example.com',
        password: 'StrongPassword123',
        fullName: 'Nguyen Van Candidate',
      };

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Đăng ký thành công');

      const { user, tokens } = res.body.data;
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(typeof user.id).toBe('string');
      expect(user.email).toBe('candidate@example.com');
      expect(user.fullName).toBe('Nguyen Van Candidate');
      expect(user.role).toBe('CANDIDATE');
      expect(user.status).toBe('ACTIVE');
      expect(user.createdAt).toBeDefined();

      expect(user.password).toBeUndefined();
      expect(user.passwordHash).toBeUndefined();

      expect(tokens).toBeDefined();
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');

      const userCount = await User.countDocuments();
      expect(userCount).toBe(1);

      const dbUser = await User.findOne({ email: 'candidate@example.com' }).select('+passwordHash');
      expect(dbUser).not.toBeNull();
      expect(dbUser?.role).toBe('CANDIDATE');
      expect(dbUser?.status).toBe('ACTIVE');
      expect(dbUser?.passwordHash).not.toBe('StrongPassword123');

      const isMatch = await bcrypt.compare('StrongPassword123', dbUser!.passwordHash);
      expect(isMatch).toBe(true);

      // Verify RefreshToken in DB
      const session = await RefreshToken.findOne({ userId: dbUser!._id });
      expect(session).not.toBeNull();
      expect(session?.isRevoked).toBe(false);
      expect(session?.tokenHash).toBe(hashToken(tokens.refreshToken));
      expect(session?.tokenHash).not.toBe(tokens.refreshToken);
    });

    it('4.2 Đăng ký với email có khoảng trắng được tự động trim và lowercase', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: '  TrImMeD.CaNdIdAtE@eXaMpLe.CoM  ',
          password: 'StrongPassword123',
          fullName: '  Trimmed Name  ',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe('trimmed.candidate@example.com');
      expect(res.body.data.user.fullName).toBe('Trimmed Name');

      const dbUser = await User.findOne({ email: 'trimmed.candidate@example.com' });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.email).toBe('trimmed.candidate@example.com');
      expect(dbUser?.fullName).toBe('Trimmed Name');
    });

    it('4.3 Đăng ký email trùng lặp (kể cả khác chữ hoa/thường): trả về 409, AUTH_EMAIL_ALREADY_EXISTS, DB vẫn có 1 user', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'StrongPassword123',
          fullName: 'Original User',
        });

      const duplicateRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'DUPLICATE@EXAMPLE.COM',
          password: 'AnotherPassword456',
          fullName: 'Duplicate User',
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.success).toBe(false);
      expect(duplicateRes.body.code).toBe('AUTH_EMAIL_ALREADY_EXISTS');
      expect(duplicateRes.body.message).toBe('Email đã được sử dụng');
      expect(duplicateRes.body.errors).toBeUndefined();
      expect(duplicateRes.body.stack).toBeUndefined();

      const count = await User.countDocuments();
      expect(count).toBe(1);
    });
  });

  // =================================================================
  // 5. VALIDATION & BCRYPT BYTE LIMIT TESTS
  // =================================================================
  describe('Input Validation & Bcrypt Byte Limit', () => {
    it('5.1 Validation: Email không hợp lệ trả về 400 và VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'StrongPassword123',
          fullName: 'Valid Name',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.some((e: any) => e.field === 'email')).toBe(true);
    });

    it('5.2 Validation: Mật khẩu quá ngắn (< 8 ký tự) trả về 400 và VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short',
          fullName: 'Valid Name',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.some((e: any) => e.field === 'password')).toBe(true);
    });

    it('5.3 Validation: Mật khẩu Unicode có <= 72 ký tự nhưng > 72 byte bị từ chối với 400, field = password', async () => {
      const unicodePassword = '🔑'.repeat(20);
      expect(unicodePassword.length).toBe(40);
      expect(Buffer.byteLength(unicodePassword, 'utf8')).toBe(80);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'unicode@example.com',
          password: unicodePassword,
          fullName: 'Unicode Password User',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.some((e: any) => e.field === 'password')).toBe(true);
    });

    it('5.4 Validation: FullName không hợp lệ (< 2 ký tự) trả về 400 và VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'StrongPassword123',
          fullName: 'A',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.some((e: any) => e.field === 'fullName')).toBe(true);
    });

    it('5.5 Validation: Gửi kèm field đặc quyền (role: ADMIN) bị từ chối với 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'hacker@example.com',
          password: 'StrongPassword123',
          fullName: 'Hacker Name',
          role: 'ADMIN',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.some((e: any) => e.field === 'role')).toBe(true);

      const count = await User.countDocuments();
      expect(count).toBe(0);
    });

    it('5.6 Validation: Gửi kèm field status hoặc passwordHash bị từ chối với 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'hacker2@example.com',
          password: 'StrongPassword123',
          fullName: 'Hacker Name',
          status: 'ACTIVE',
          passwordHash: 'fakehash',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('5.7 Validation Login: Mật khẩu Unicode > 72 byte ở login bị từ chối với 400, field = password', async () => {
      const unicodePassword = '🔑'.repeat(20);
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: unicodePassword,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.some((e: any) => e.field === 'password')).toBe(true);
    });
  });

  // =================================================================
  // 6. LOGIN THÀNH CÔNG & THẤT BẠI
  // =================================================================
  describe('POST /api/v1/auth/login', () => {
    it('6.1 Login thành công: trả 200, đúng message tiếng Việt UTF-8, JWT payload { sub, role, type }, tạo session DB', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'login.test@example.com',
          password: 'StrongPassword123',
          fullName: 'Login Tester',
        });
      const registeredUserId = regRes.body.data.user.id;

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login.test@example.com',
          password: 'StrongPassword123',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.message).toBe('Đăng nhập thành công');

      const { user, tokens } = loginRes.body.data;
      expect(user.id).toBe(registeredUserId);
      expect(user.email).toBe('login.test@example.com');
      expect(user.fullName).toBe('Login Tester');
      expect(user.role).toBe('CANDIDATE');
      expect(user.status).toBe('ACTIVE');
      expect(user.passwordHash).toBeUndefined();

      const accessPayload = verifyAccessToken(tokens.accessToken);
      expect(accessPayload.sub).toBe(registeredUserId);
      expect(accessPayload.role).toBe('CANDIDATE');
      expect(accessPayload.type).toBe('access');

      const refreshPayload = verifyRefreshToken(tokens.refreshToken);
      expect(refreshPayload.sub).toBe(registeredUserId);
      expect(refreshPayload.role).toBe('CANDIDATE');
      expect(refreshPayload.type).toBe('refresh');

      // Verify DB contains refresh token record
      const session = await RefreshToken.findOne({ jti: refreshPayload.jti });
      expect(session).not.toBeNull();
      expect(session?.userId.toString()).toBe(registeredUserId);
      expect(session?.isRevoked).toBe(false);
    });

    it('6.2 Login thành công đối với Admin đã tồn tại', async () => {
      const passwordHash = await bcrypt.hash('AdminPassword123', 10);
      const admin = await User.create({
        email: 'admin@vti.com.vn',
        passwordHash,
        fullName: 'Admin System',
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@vti.com.vn',
          password: 'AdminPassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('ADMIN');

      const accessPayload = verifyAccessToken(res.body.data.tokens.accessToken);
      expect(accessPayload.sub).toBe(admin._id.toString());
      expect(accessPayload.role).toBe('ADMIN');
    });

    it('6.3 Login thất bại: email không tồn tại và password sai trả về cùng status, code và message UTF-8', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'CorrectPassword123',
          fullName: 'Existing User',
        });

      const nonExistentRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123',
        });

      const wrongPasswordRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'existing@example.com',
          password: 'WrongPassword999',
        });

      expect(nonExistentRes.status).toBe(401);
      expect(wrongPasswordRes.status).toBe(401);

      expect(nonExistentRes.body.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(wrongPasswordRes.body.code).toBe('AUTH_INVALID_CREDENTIALS');

      expect(nonExistentRes.body.message).toBe('Email hoặc mật khẩu không chính xác');
      expect(wrongPasswordRes.body.message).toBe('Email hoặc mật khẩu không chính xác');
    });

    it('6.4 User trạng thái INACTIVE không thể login và trả về cùng mã lỗi 401 AUTH_INVALID_CREDENTIALS', async () => {
      const passwordHash = await bcrypt.hash('InactiveUserPassword123', 10);
      await User.create({
        email: 'inactive@example.com',
        passwordHash,
        fullName: 'Inactive User',
        role: 'CANDIDATE',
        status: 'INACTIVE',
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'inactive@example.com',
          password: 'InactiveUserPassword123',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(res.body.message).toBe('Email hoặc mật khẩu không chính xác');
    });

    it('6.5 Validation Login: gửi field thừa bị từ chối với 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'StrongPassword123',
          extraField: 'not_allowed',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('6.6 User trạng thái LOCKED bị từ chối khi login với 403 AUTH_ACCOUNT_LOCKED', async () => {
      const passwordHash = await bcrypt.hash('LockedUserPassword123', 10);
      await User.create({
        email: 'locked@example.com',
        passwordHash,
        fullName: 'Locked User',
        role: 'CANDIDATE',
        status: 'LOCKED',
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'locked@example.com',
          password: 'LockedUserPassword123',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_ACCOUNT_LOCKED');
      expect(res.body.message).toBe('Tài khoản đã bị khóa');
    });
  });

  // =================================================================
  // 7. AIP-16: REFRESH TOKEN ROTATION & REUSE DETECTION
  // =================================================================
  describe('POST /api/v1/auth/refresh', () => {
    it('7.1 Refresh thành công: Cấp token mới cho cùng phiên (sessionId), thu hồi token cũ', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'rotation@example.com',
          password: 'StrongPassword123',
          fullName: 'Rotation User',
        });

      const initialTokens = regRes.body.data.tokens;
      const initialRefreshPayload = verifyRefreshToken(initialTokens.refreshToken);

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: initialTokens.refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.message).toBe('Làm mới token thành công');

      const { tokens: newTokens, user } = refreshRes.body.data;
      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.refreshToken).not.toBe(initialTokens.refreshToken);
      expect(user.email).toBe('rotation@example.com');

      const newRefreshPayload = verifyRefreshToken(newTokens.refreshToken);
      expect(newRefreshPayload.sessionId).toBe(initialRefreshPayload.sessionId);
      expect(newRefreshPayload.jti).not.toBe(initialRefreshPayload.jti);

      // Verify old token is marked revoked in DB
      const oldSession = await RefreshToken.findOne({ jti: initialRefreshPayload.jti });
      expect(oldSession?.isRevoked).toBe(true);
      expect(oldSession?.revokedAt).toBeDefined();

      // Verify new token is active in DB
      const newSession = await RefreshToken.findOne({ jti: newRefreshPayload.jti });
      expect(newSession?.isRevoked).toBe(false);
      expect(newSession?.sessionId).toBe(initialRefreshPayload.sessionId);
    });

    it('7.2 Token Reuse Detection: Dùng lại token cũ sau khi đã rotate sẽ thu hồi đúng session family', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'reuse@example.com',
          password: 'StrongPassword123',
          fullName: 'Reuse Tester',
        });

      const initialRefreshToken = regRes.body.data.tokens.refreshToken;

      // First refresh: rotates successfully
      const firstRefresh = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(firstRefresh.status).toBe(200);
      const rotatedRefreshToken = firstRefresh.body.data.tokens.refreshToken;

      // Second refresh with initialRefreshToken (REUSE ATTACK!)
      const reuseRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.code).toBe('AUTH_TOKEN_REVOKED');

      // Verify that even the rotatedRefreshToken was revoked due to reuse detection
      const nextRefreshWithRotated = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotatedRefreshToken });

      expect(nextRefreshWithRotated.status).toBe(401);
    });

    it('7.3 Refresh thất bại: Refresh token không hợp lệ (sai signature) bị từ chối 401', async () => {
      const invalidToken = jwt.sign(
        { sub: 'user-123', role: 'CANDIDATE', type: 'refresh', jti: 'fake-jti' },
        'wrong-secret-that-does-not-match-at-least-32-chars-long',
        { algorithm: 'HS256' }
      );

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: invalidToken });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_INVALID_REFRESH_TOKEN');
    });

    it('7.4 Refresh thất bại: Dùng access token thay cho refresh token bị từ chối 401', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'wrongtoken@example.com',
          password: 'StrongPassword123',
          fullName: 'Wrong Token User',
        });

      const accessToken = regRes.body.data.tokens.accessToken;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: accessToken });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_INVALID_REFRESH_TOKEN');
    });

    it('7.5 Refresh thất bại: User bị LOCKED bị từ chối với 403 AUTH_ACCOUNT_LOCKED', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'lockedrefresh@example.com',
          password: 'StrongPassword123',
          fullName: 'Locked Refresh User',
        });

      const userId = regRes.body.data.user.id;
      const refreshToken = regRes.body.data.tokens.refreshToken;

      // A lock must take precedence even when its refresh record was already revoked.
      const refreshPayload = verifyRefreshToken(refreshToken);
      await RefreshToken.updateOne(
        { jti: refreshPayload.jti },
        { isRevoked: true, revokedAt: new Date() }
      );
      await User.findByIdAndUpdate(userId, { status: 'LOCKED' });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_ACCOUNT_LOCKED');
      expect(res.body.message).toBe('Tài khoản đã bị khóa');
    });

    it('7.6 Refresh dùng role hiện tại từ DB thay vì role cũ trong refresh JWT', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'role-change-refresh@example.com',
          password: 'StrongPassword123',
          fullName: 'Role Change Refresh User',
        });

      const userId = regRes.body.data.user.id;
      const refreshToken = regRes.body.data.tokens.refreshToken;
      expect(verifyRefreshToken(refreshToken).role).toBe('CANDIDATE');

      await User.findByIdAndUpdate(userId, { role: 'INTERVIEWER' });

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.user.role).toBe('INTERVIEWER');
      expect(verifyAccessToken(refreshRes.body.data.tokens.accessToken).role).toBe('INTERVIEWER');
    });

    it('7.7 Validation Refresh: Gửi body thiếu refreshToken hoặc có field thừa bị 400', async () => {
      const emptyRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(emptyRes.status).toBe(400);
      expect(emptyRes.body.code).toBe('VALIDATION_ERROR');

      const extraRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'some-token', extra: 'not-allowed' });

      expect(extraRes.status).toBe(400);
      expect(extraRes.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // =================================================================
  // 8. AIP-16: LOGOUT FLOW
  // =================================================================
  describe('POST /api/v1/auth/logout', () => {
    it('8.1 Logout thành công: Thu hồi refresh-token session hiện tại, từ chối refresh sau đó', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'logout@example.com',
          password: 'StrongPassword123',
          fullName: 'Logout User',
        });

      const { refreshToken } = regRes.body.data.tokens;

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);
      expect(logoutRes.body.message).toBe('Đăng xuất thành công');

      // Attempt to refresh with the revoked token
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
      expect(['AUTH_TOKEN_REVOKED', 'AUTH_INVALID_REFRESH_TOKEN']).toContain(refreshRes.body.code);
    });

    it('8.2 Logout lặp lại với token đã thu hồi giữ contract idempotent 200', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'logout2@example.com',
          password: 'StrongPassword123',
          fullName: 'Logout User 2',
        });

      const { refreshToken } = regRes.body.data.tokens;

      // First logout
      await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken });

      // Second logout with same token
      const secondLogout = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken });

      expect(secondLogout.status).toBe(200);
      expect(secondLogout.body).toMatchObject({ success: true, message: 'Đăng xuất thành công' });
    });

    it('8.3 Validation Logout: Gửi kèm field thừa bị từ chối 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .send({
          refreshToken: 'token',
          extraField: 'value',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // =================================================================
  // 9. AIP-16: ACCOUNT LOCK & ADMIN AUTHORIZATION
  // =================================================================
  describe('PATCH /api/v1/auth/users/:id/lock', () => {
    let adminToken: string;
    let adminId: string;
    let candidateToken: string;
    let candidateId: string;
    let targetUserId: string;
    let targetRefreshToken: string;

    beforeEach(async () => {
      // Create Admin
      const adminHash = await bcrypt.hash('AdminPassword123', 10);
      const admin = await User.create({
        email: 'admin.lock@vti.com.vn',
        passwordHash: adminHash,
        fullName: 'Admin User',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      adminId = admin._id.toString();
      const adminTokens = generateAuthTokens(adminId, 'ADMIN');
      adminToken = adminTokens.accessToken;

      // Create Candidate
      const candidateHash = await bcrypt.hash('CandidatePassword123', 10);
      const candidate = await User.create({
        email: 'candidate.lock@example.com',
        passwordHash: candidateHash,
        fullName: 'Candidate User',
        role: 'CANDIDATE',
        status: 'ACTIVE',
      });
      candidateId = candidate._id.toString();
      const candidateTokens = generateAuthTokens(candidateId, 'CANDIDATE');
      candidateToken = candidateTokens.accessToken;

      // Register Target User to have active sessions
      const targetRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'target.user@example.com',
          password: 'TargetPassword123',
          fullName: 'Target User',
        });
      targetUserId = targetRes.body.data.user.id;
      targetRefreshToken = targetRes.body.data.tokens.refreshToken;
    });

    it('9.1 Admin lock tài khoản thành công: Cập nhật status LOCKED, thu hồi toàn bộ refresh session của user', async () => {
      const res = await request(app)
        .patch(`/api/v1/auth/users/${targetUserId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Khóa tài khoản thành công');
      expect(res.body.data.user.status).toBe('LOCKED');

      // Verify in DB
      const dbTarget = await User.findById(targetUserId);
      expect(dbTarget?.status).toBe('LOCKED');

      // Verify all sessions of target user are revoked
      const activeSessions = await RefreshToken.find({ userId: targetUserId, isRevoked: false });
      expect(activeSessions.length).toBe(0);

      // Verify target user cannot login
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'target.user@example.com',
          password: 'TargetPassword123',
        });
      expect(loginRes.status).toBe(403);
      expect(loginRes.body.code).toBe('AUTH_ACCOUNT_LOCKED');

      // Verify target user cannot refresh
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: targetRefreshToken });
      expect(refreshRes.status).toBe(403);
      expect(refreshRes.body.code).toBe('AUTH_ACCOUNT_LOCKED');
    });

    it('9.1a Alias /lock/:id thực hiện cùng contract khóa tài khoản', async () => {
      const res = await request(app)
        .patch(`/api/v1/auth/lock/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.status).toBe('LOCKED');

      const activeSessions = await RefreshToken.find({ userId: targetUserId, isRevoked: false });
      expect(activeSessions).toHaveLength(0);
    });

    it('9.2 Admin không thể tự lock tài khoản của chính mình (Self-lock protection)', async () => {
      const res = await request(app)
        .patch(`/api/v1/auth/users/${adminId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('AUTH_CANNOT_LOCK_SELF');
      expect(res.body.message).toBe('Không thể tự khóa tài khoản của chính mình');

      // Verify admin is still active
      const dbAdmin = await User.findById(adminId);
      expect(dbAdmin?.status).toBe('ACTIVE');
    });

    it('9.3 User không phải ADMIN (CANDIDATE) bị từ chối với 403 AUTH_FORBIDDEN', async () => {
      const res = await request(app)
        .patch(`/api/v1/auth/users/${targetUserId}/lock`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_FORBIDDEN');
    });

    it('9.4 Request không có token hoặc token sai bị từ chối 401 AUTH_UNAUTHORIZED', async () => {
      const noTokenRes = await request(app)
        .patch(`/api/v1/auth/users/${targetUserId}/lock`);

      expect(noTokenRes.status).toBe(401);
      expect(noTokenRes.body.code).toBe('AUTH_UNAUTHORIZED');

      const badTokenRes = await request(app)
        .patch(`/api/v1/auth/users/${targetUserId}/lock`)
        .set('Authorization', 'Bearer invalid-token');

      expect(badTokenRes.status).toBe(401);
      expect(badTokenRes.body.code).toBe('AUTH_UNAUTHORIZED');

      const malformedSubjectAccessToken = jwt.sign(
        { sub: 'not-a-mongodb-object-id', role: 'ADMIN', type: 'access' },
        process.env.JWT_ACCESS_SECRET!,
        { algorithm: 'HS256', expiresIn: '15m' }
      );
      const malformedSubjectRes = await request(app)
        .patch(`/api/v1/auth/users/${targetUserId}/lock`)
        .set('Authorization', `Bearer ${malformedSubjectAccessToken}`);

      expect(malformedSubjectRes.status).toBe(401);
      expect(malformedSubjectRes.body.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('9.5 Admin có status LOCKED trong DB bị từ chối dù token claim là ADMIN', async () => {
      await User.findByIdAndUpdate(adminId, { status: 'LOCKED' });

      const res = await request(app)
        .patch(`/api/v1/auth/users/${targetUserId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_ACCOUNT_LOCKED');
    });

    it('9.5a Admin có role bị thay đổi trong DB bị từ chối dù JWT cũ vẫn claim ADMIN', async () => {
      await User.findByIdAndUpdate(adminId, { role: 'CANDIDATE' });

      const res = await request(app)
        .patch(`/api/v1/auth/users/${targetUserId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_FORBIDDEN');
    });

    it('9.6 Lock user không tồn tại trả về 404 AUTH_USER_NOT_FOUND', async () => {
      const fakeObjectId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/v1/auth/users/${fakeObjectId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('AUTH_USER_NOT_FOUND');
    });

    it('9.7 Validation: ID người dùng sai định dạng ObjectId bị từ chối 400', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/users/invalid-id-format/lock')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // =================================================================
  // 10. SECURITY BINDINGS, SESSION ISOLATION & CONCURRENCY TESTS
  // =================================================================
  describe('Security Token Binding, Multi-Session Isolation & Concurrency', () => {
    it('10.1 Từ chối refresh và logout khi tokenHash trong DB không khớp với raw token', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'hashmismatch@example.com',
          password: 'StrongPassword123',
          fullName: 'Hash Mismatch User',
        });
      const refreshToken = regRes.body.data.tokens.refreshToken;
      const payload = verifyRefreshToken(refreshToken);

      // Mutate the tokenHash in DB to a different hash
      await RefreshToken.updateOne(
        { jti: payload.jti },
        { tokenHash: hashToken('completely-different-token') }
      );

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
      expect(refreshRes.body.code).toBe('AUTH_INVALID_REFRESH_TOKEN');

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken });

      expect(logoutRes.status).toBe(401);
      expect(logoutRes.body.code).toBe('AUTH_INVALID_REFRESH_TOKEN');
    });

    it('10.1a Từ chối sessionId DB không khớp và không thu hồi session độc lập', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'session-binding@example.com',
          password: 'StrongPassword123',
          fullName: 'Session Binding User',
        });
      const firstRefreshToken = regRes.body.data.tokens.refreshToken;
      const firstPayload = verifyRefreshToken(firstRefreshToken);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'session-binding@example.com',
          password: 'StrongPassword123',
        });
      const secondRefreshToken = loginRes.body.data.tokens.refreshToken;
      const secondPayload = verifyRefreshToken(secondRefreshToken);

      await RefreshToken.updateOne(
        { jti: firstPayload.jti },
        { sessionId: '00000000-0000-4000-8000-000000000001' }
      );

      const rejectedRefresh = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: firstRefreshToken });

      expect(rejectedRefresh.status).toBe(401);
      expect(rejectedRefresh.body.code).toBe('AUTH_INVALID_REFRESH_TOKEN');

      const independentSession = await RefreshToken.findOne({ jti: secondPayload.jti });
      expect(independentSession?.isRevoked).toBe(false);

      const secondRefresh = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: secondRefreshToken });
      expect(secondRefresh.status).toBe(200);
    });

    it('10.2 Từ chối token đã ký hợp lệ nhưng sub hoặc sessionId không khớp với record trong DB', async () => {
      const regRes1 = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'user1.binding@example.com',
          password: 'StrongPassword123',
          fullName: 'User 1 Binding',
        });
      const regRes2 = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'user2.binding@example.com',
          password: 'StrongPassword123',
          fullName: 'User 2 Binding',
        });

      const user1Token = regRes1.body.data.tokens.refreshToken;
      const user2Id = regRes2.body.data.user.id;
      const user1Payload = verifyRefreshToken(user1Token);

      // Sign a valid refresh token with user2's sub but user1's jti and sessionId
      const forgedSubToken = jwt.sign(
        {
          sub: user2Id,
          role: 'CANDIDATE',
          type: 'refresh',
          jti: user1Payload.jti,
          sessionId: user1Payload.sessionId,
        },
        process.env.JWT_REFRESH_SECRET!,
        { algorithm: 'HS256', expiresIn: '7d' }
      );

      const refreshRes1 = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: forgedSubToken });

      expect(refreshRes1.status).toBe(401);
      expect(refreshRes1.body.code).toBe('AUTH_INVALID_REFRESH_TOKEN');

      // Sign a valid refresh token with forged sessionId
      const forgedSessionToken = jwt.sign(
        {
          sub: user1Payload.sub,
          role: 'CANDIDATE',
          type: 'refresh',
          jti: user1Payload.jti,
          sessionId: 'completely-different-session-id',
        },
        process.env.JWT_REFRESH_SECRET!,
        { algorithm: 'HS256', expiresIn: '7d' }
      );

      const refreshRes2 = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: forgedSessionToken });

      expect(refreshRes2.status).toBe(401);
      expect(refreshRes2.body.code).toBe('AUTH_INVALID_REFRESH_TOKEN');

      const originalSession = await RefreshToken.findOne({ jti: user1Payload.jti });
      expect(originalSession?.isRevoked).toBe(false);

      const legitimateRefresh = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user1Token });
      expect(legitimateRefresh.status).toBe(200);
    });

    it('10.2a Từ chối refresh JWT có sub không hợp lệ thay vì để CastError thành 500', async () => {
      const malformedSubjectToken = jwt.sign(
        {
          sub: 'not-a-mongodb-object-id',
          role: 'CANDIDATE',
          type: 'refresh',
          jti: '00000000-0000-4000-8000-000000000002',
          sessionId: '00000000-0000-4000-8000-000000000003',
        },
        process.env.JWT_REFRESH_SECRET!,
        { algorithm: 'HS256', expiresIn: '7d' }
      );

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: malformedSubjectToken });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_INVALID_REFRESH_TOKEN');
    });

    it('10.3 Đa phiên (multi-session): Logout phiên 1 không ảnh hưởng đến phiên 2 độc lập của cùng user', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'multisession@example.com',
          password: 'StrongPassword123',
          fullName: 'Multi Session User',
        });
      const session1RefreshToken = regRes.body.data.tokens.refreshToken;

      // Second login creates session 2
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'multisession@example.com',
          password: 'StrongPassword123',
        });
      const session2RefreshToken = loginRes.body.data.tokens.refreshToken;

      // Ensure they have different sessionIds
      const p1 = verifyRefreshToken(session1RefreshToken);
      const p2 = verifyRefreshToken(session2RefreshToken);
      expect(p1.sessionId).not.toBe(p2.sessionId);

      // Logout session 1
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: session1RefreshToken });
      expect(logoutRes.status).toBe(200);

      // Session 1 cannot be refreshed
      const refresh1Res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session1RefreshToken });
      expect(refresh1Res.status).toBe(401);

      // Session 2 is still active and can rotate successfully
      const refresh2Res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session2RefreshToken });
      expect(refresh2Res.status).toBe(200);
      expect(refresh2Res.body.success).toBe(true);
    });

    it('10.4 Đa phiên (multi-session): Replay ở phiên 1 chỉ thu hồi family 1, phiên 2 vẫn hoạt động bình thường', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'multireplay@example.com',
          password: 'StrongPassword123',
          fullName: 'Multi Replay User',
        });
      const session1InitialToken = regRes.body.data.tokens.refreshToken;

      // Session 2 via login
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'multireplay@example.com',
          password: 'StrongPassword123',
        });
      const session2Token = loginRes.body.data.tokens.refreshToken;

      // Rotate session 1
      const rotate1Res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session1InitialToken });
      expect(rotate1Res.status).toBe(200);

      // Replay attack on session 1 with old token
      const replayRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session1InitialToken });
      expect(replayRes.status).toBe(401);
      expect(replayRes.body.code).toBe('AUTH_TOKEN_REVOKED');

      // Session 2 is NOT affected by session 1 replay
      const refresh2Res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session2Token });
      expect(refresh2Res.status).toBe(200);
      expect(refresh2Res.body.success).toBe(true);
    });

    it('10.5 Race Refresh đồng thời: Chính xác 1 request trả 200, phát hiện reuse và thu hồi toàn bộ session family', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'race.refresh@example.com',
          password: 'StrongPassword123',
          fullName: 'Race Refresh User',
        });
      const userId = regRes.body.data.user.id;
      const refreshToken = regRes.body.data.tokens.refreshToken;
      const p = verifyRefreshToken(refreshToken);

      // Fire 2 concurrent refresh requests
      const [res1, res2] = await Promise.all([
        request(app).post('/api/v1/auth/refresh').send({ refreshToken }),
        request(app).post('/api/v1/auth/refresh').send({ refreshToken }),
      ]);

      const responses = [res1, res2];
      const successfulResponses = responses.filter((res) => res.status === 200);
      const rejectedResponses = responses.filter((res) => res.status === 401);

      expect(successfulResponses).toHaveLength(1);
      expect(rejectedResponses).toHaveLength(1);
      expect(rejectedResponses[0].status).toBe(401);
      expect(rejectedResponses[0].body.code).toBe('AUTH_TOKEN_REVOKED');

      const oldToken = await RefreshToken.findOne({ jti: p.jti });
      expect(oldToken?.isRevoked).toBe(true);

      const replacementTokens = await RefreshToken.find({
        userId,
        sessionId: p.sessionId,
        jti: { $ne: p.jti },
      });
      expect(replacementTokens).toHaveLength(1);
      expect(replacementTokens[0].isRevoked).toBe(true);
      expect(replacementTokens[0].revokedAt).toBeDefined();

      const activeTokens = await RefreshToken.find({
        userId,
        sessionId: p.sessionId,
        isRevoked: false,
      });
      expect(activeTokens).toHaveLength(0);

      const winningRefreshToken = successfulResponses[0].body.data.tokens.refreshToken;
      const replayResult = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: winningRefreshToken });
      expect(replayResult.status).toBe(401);
      expect(replayResult.body.code).toBe('AUTH_TOKEN_REVOKED');
    });

    it('10.6 Race Refresh vs Account Lock: Sau khi cả hai hoàn tất, User phải là LOCKED và không còn active refresh session', async () => {
      // Create admin
      const adminHash = await bcrypt.hash('AdminPass123', 10);
      const admin = await User.create({
        email: 'admin.race@vti.com.vn',
        passwordHash: adminHash,
        fullName: 'Admin Race',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      const adminTokens = generateAuthTokens(admin._id.toString(), 'ADMIN');

      // Create target user
      const targetRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'target.race@example.com',
          password: 'TargetPassword123',
          fullName: 'Target Race User',
        });
      const targetUserId = targetRes.body.data.user.id;
      const targetRefreshToken = targetRes.body.data.tokens.refreshToken;

      // Race refresh and lock simultaneously
      const [refreshRes, lockRes] = await Promise.all([
        request(app).post('/api/v1/auth/refresh').send({ refreshToken: targetRefreshToken }),
        request(app)
          .patch(`/api/v1/auth/users/${targetUserId}/lock`)
          .set('Authorization', `Bearer ${adminTokens.accessToken}`),
      ]);

      expect(lockRes.status).toBe(200);

      // Verify target user is LOCKED
      const finalUser = await User.findById(targetUserId);
      expect(finalUser?.status).toBe('LOCKED');

      // Verify ZERO active refresh records for target user
      const activeSessions = await RefreshToken.find({
        userId: targetUserId,
        isRevoked: false,
      });
      expect(activeSessions.length).toBe(0);

      if (refreshRes.status === 200) {
        const replacementRefreshToken = refreshRes.body.data.tokens.refreshToken;
        const refreshAfterLock = await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: replacementRefreshToken });
        expect(refreshAfterLock.status).toBe(403);
        expect(refreshAfterLock.body.code).toBe('AUTH_ACCOUNT_LOCKED');
      } else {
        expect(refreshRes.status).toBe(403);
        expect(refreshRes.body.code).toBe('AUTH_ACCOUNT_LOCKED');
      }
    });

    it('10.7 Race Refresh vs Logout: nếu logout thắng thì không còn replacement token active', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'logout-refresh-race@example.com',
          password: 'StrongPassword123',
          fullName: 'Logout Refresh Race User',
        });
      const userId = regRes.body.data.user.id;
      const refreshToken = regRes.body.data.tokens.refreshToken;
      const payload = verifyRefreshToken(refreshToken);

      const [logoutRes, refreshRes] = await Promise.all([
        request(app).post('/api/v1/auth/logout').send({ refreshToken }),
        request(app).post('/api/v1/auth/refresh').send({ refreshToken }),
      ]);

      expect([200, 401]).toContain(logoutRes.status);
      expect([200, 401]).toContain(refreshRes.status);

      if (refreshRes.status === 401) {
        expect(logoutRes.status).toBe(200);
        const activeTokens = await RefreshToken.find({
          userId,
          sessionId: payload.sessionId,
          isRevoked: false,
        });
        expect(activeTokens).toHaveLength(0);
      } else {
        expect(refreshRes.status).toBe(200);
        expect([200, 401]).toContain(logoutRes.status);

        const activeTokens = await RefreshToken.find({
          userId,
          sessionId: payload.sessionId,
          isRevoked: false,
        });
        expect(activeTokens).toHaveLength(1);

        const replacementRefreshToken = refreshRes.body.data.tokens.refreshToken;
        expect(hashToken(replacementRefreshToken)).toBe(activeTokens[0].tokenHash);

        const nextRefreshRes = await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: replacementRefreshToken });
        expect(nextRefreshRes.status).toBe(200);
        expect(nextRefreshRes.body.success).toBe(true);
      }
    });

    it('10.7a Tuần tự Refresh trước Logout: logout token cũ idempotent và không thu hồi replacement token', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'seq-refresh-logout@example.com',
          password: 'StrongPassword123',
          fullName: 'Sequential Refresh Logout User',
        });
      const initialRefreshToken = regRes.body.data.tokens.refreshToken;

      // 1. Refresh token cũ thành công
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: initialRefreshToken });
      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      const replacementRefreshToken = refreshRes.body.data.tokens.refreshToken;

      // 2. Logout bằng token cũ là idempotent
      const logoutOldRes = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: initialRefreshToken });
      expect(logoutOldRes.status).toBe(200);
      expect(logoutOldRes.body.success).toBe(true);

      // 3. Replacement token vẫn refresh thành công
      const nextRefreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: replacementRefreshToken });
      expect(nextRefreshRes.status).toBe(200);
      expect(nextRefreshRes.body.success).toBe(true);
    });

    it('10.8 Race Login vs Account Lock: không có login replacement sống sau khi lock thắng', async () => {
      const adminHash = await bcrypt.hash('AdminRaceLogin123', 10);
      const admin = await User.create({
        email: 'admin.login-race@vti.com.vn',
        passwordHash: adminHash,
        fullName: 'Admin Login Race',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      const adminToken = generateAuthTokens(admin._id.toString(), 'ADMIN').accessToken;

      const targetRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'target.login-race@example.com',
          password: 'TargetPassword123',
          fullName: 'Target Login Race User',
        });
      const targetUserId = targetRes.body.data.user.id;

      const [loginRes, lockRes] = await Promise.all([
        request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'target.login-race@example.com', password: 'TargetPassword123' }),
        request(app)
          .patch(`/api/v1/auth/users/${targetUserId}/lock`)
          .set('Authorization', `Bearer ${adminToken}`),
      ]);

      expect(lockRes.status).toBe(200);
      const targetUser = await User.findById(targetUserId);
      expect(targetUser?.status).toBe('LOCKED');

      const activeTokens = await RefreshToken.find({ userId: targetUserId, isRevoked: false });
      expect(activeTokens).toHaveLength(0);

      if (loginRes.status === 200) {
        const loginRefreshToken = loginRes.body.data.tokens.refreshToken;
        const refreshAfterLock = await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: loginRefreshToken });
        expect(refreshAfterLock.status).toBe(403);
        expect(refreshAfterLock.body.code).toBe('AUTH_ACCOUNT_LOCKED');
      } else {
        expect(loginRes.status).toBe(403);
        expect(loginRes.body.code).toBe('AUTH_ACCOUNT_LOCKED');
      }
    });
  });

  // =================================================================
  // 11. CREDENTIAL VERSION & SESSION ISOLATION TESTS
  // =================================================================
  describe('11. Credential Version Lifecycle & Multi-Session Isolation', () => {
    it('11.1 Đăng ký mới gán credentialVersion = 0 và cấp token version 0', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'credver.new@example.com',
          password: 'Password123',
          fullName: 'CredVer User',
        });

      expect(regRes.status).toBe(201);
      const user = await User.findOne({ email: 'credver.new@example.com' });
      expect(user?.credentialVersion).toBe(0);

      const accessPayload = verifyAccessToken(regRes.body.data.tokens.accessToken);
      expect(accessPayload.credentialVersion).toBe(0);

      // SafeUser does not expose credentialVersion
      expect(regRes.body.data.user.credentialVersion).toBeUndefined();
    });

    it('11.2 Người dùng legacy (không có field credentialVersion trong DB) đăng nhập nhận token version 0', async () => {
      const passwordHash = await bcrypt.hash('LegacyPass123', 10);
      const legacyUser = await User.create({
        email: 'legacy.user@example.com',
        passwordHash,
        fullName: 'Legacy User',
        role: 'CANDIDATE',
        status: 'ACTIVE',
      });
      // Unset credentialVersion to simulate legacy record
      await User.updateOne({ _id: legacyUser._id }, { $unset: { credentialVersion: 1 } });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'legacy.user@example.com',
          password: 'LegacyPass123',
        });

      expect(loginRes.status).toBe(200);
      const accessPayload = verifyAccessToken(loginRes.body.data.tokens.accessToken);
      expect(accessPayload.credentialVersion).toBe(0);
    });

    it('11.3 Multi-session: Đăng nhập và refresh độc lập không làm tăng credentialVersion và không làm hỏng access token khác', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'multisession@example.com',
          password: 'Password123',
          fullName: 'Multi Session User',
        });

      const session1AccessToken = regRes.body.data.tokens.accessToken;
      const session1RefreshToken = regRes.body.data.tokens.refreshToken;

      // Session 2 login
      const session2Login = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'multisession@example.com',
          password: 'Password123',
        });
      const session2AccessToken = session2Login.body.data.tokens.accessToken;
      const session2RefreshToken = session2Login.body.data.tokens.refreshToken;

      // Refresh session 1
      const refresh1Res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session1RefreshToken });
      expect(refresh1Res.status).toBe(200);

      // Session 2 access token remains valid because credentialVersion did not change
      const user = await User.findOne({ email: 'multisession@example.com' });
      expect(user?.credentialVersion).toBe(0);
      expect(verifyAccessToken(session2AccessToken).credentialVersion).toBe(0);

      // Refresh session 2
      const refresh2Res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session2RefreshToken });
      expect(refresh2Res.status).toBe(200);
    });

    it('11.4 Khóa tài khoản (lockUser) tăng credentialVersion và thu hồi toàn bộ session', async () => {
      const adminHash = await bcrypt.hash('AdminPassword123', 10);
      const admin = await User.create({
        email: 'admin.lockcred@vti.com.vn',
        passwordHash: adminHash,
        fullName: 'Admin Lock Cred',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      const adminToken = generateAuthTokens(admin._id.toString(), 'ADMIN').accessToken;

      const targetRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'target.lockcred@example.com',
          password: 'TargetPassword123',
          fullName: 'Target User',
        });
      const targetUserId = targetRes.body.data.user.id;
      const targetAccessToken = targetRes.body.data.tokens.accessToken;

      const lockRes = await request(app)
        .patch(`/api/v1/auth/users/${targetUserId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(lockRes.status).toBe(200);

      const targetUser = await User.findById(targetUserId);
      expect(targetUser?.status).toBe('LOCKED');
      expect(targetUser?.credentialVersion).toBe(1);

      // Stored token fails on authenticated endpoint
      const resAfterLock = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${targetAccessToken}`)
        .send({ currentPassword: 'TargetPassword123', newPassword: 'NewPassword456' });

      expect(resAfterLock.status).toBe(403);
      expect(resAfterLock.body.code).toBe('AUTH_ACCOUNT_LOCKED');
    });
  });
});
