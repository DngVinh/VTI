import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

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
import { generateAuthTokens } from '../src/utils/token';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

const createUser = async (email = 'candidate@example.com') => {
  const user = await User.create({
    email,
    passwordHash: 'not-used-by-profile-tests',
    fullName: 'Candidate User',
    role: 'CANDIDATE',
    status: 'ACTIVE',
  });
  const { accessToken } = generateAuthTokens(user._id.toString(), user.role);
  return { user, authorization: `Bearer ${accessToken}` };
};

describe('AIP-19 profile API', () => {
  it('requires authentication for both profile endpoints', async () => {
    const getResponse = await request(app).get('/api/v1/profile');
    const patchResponse = await request(app).patch('/api/v1/profile').send({ fullName: 'New Name' });

    expect(getResponse.status).toBe(401);
    expect(patchResponse.status).toBe(401);
    expect(getResponse.body.code).toBe('AUTH_UNAUTHORIZED');
    expect(patchResponse.body.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('returns only the canonical safe current profile', async () => {
    const { user, authorization } = await createUser();
    await User.updateOne(
      { _id: user._id },
      {
        avatarUrl: 'https://cdn.example.com/avatar.png',
        currentLevel: 'MIDDLE',
        githubUrl: 'https://github.com/candidate',
        linkedinUrl: 'https://linkedin.com/in/candidate',
      }
    );

    const response = await request(app).get('/api/v1/profile').set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: user._id.toString(),
      email: 'candidate@example.com',
      fullName: 'Candidate User',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      currentLevel: 'MIDDLE',
      githubUrl: 'https://github.com/candidate',
      linkedinUrl: 'https://linkedin.com/in/candidate',
    });
    for (const internalField of ['password', 'passwordHash', 'authVersion', 'tokens', '_id', '__v']) {
      expect(response.body.data[internalField]).toBeUndefined();
    }
  });

  it('persists an own-profile update and returns it after reload', async () => {
    const { user, authorization } = await createUser();
    const payload = {
      fullName: 'Updated Candidate',
      avatarUrl: 'https://cdn.example.com/new.png',
      currentLevel: 'SENIOR',
      githubUrl: 'https://github.com/updated',
      linkedinUrl: 'https://linkedin.com/in/updated',
    };

    const updateResponse = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', authorization)
      .send(payload);
    const reloadResponse = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', authorization);
    const stored = await User.findById(user._id);

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data).toMatchObject(payload);
    expect(reloadResponse.body.data).toMatchObject(payload);
    expect(stored?.fullName).toBe(payload.fullName);
    expect(stored?.currentLevel).toBe(payload.currentLevel);
  });

  it('accepts uploaded avatar url path (/uploads/avatars/...) in profile update', async () => {
    const { user, authorization } = await createUser();
    const payload = {
      fullName: 'Avatar Candidate',
      avatarUrl: '/uploads/avatars/avatar-6aadef0d9295dbf9d50889b3-1789786076652.jpg',
    };

    const updateResponse = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', authorization)
      .send(payload);

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.avatarUrl).toBe(payload.avatarUrl);
    const stored = await User.findById(user._id);
    expect(stored?.avatarUrl).toBe(payload.avatarUrl);
  });

  it('uses only the authenticated identity and never a query user id', async () => {
    const owner = await createUser('owner@example.com');
    const other = await createUser('other@example.com');

    const response = await request(app)
      .patch(`/api/v1/profile?id=${other.user._id.toString()}`)
      .set('Authorization', owner.authorization)
      .send({ fullName: 'Owner Updated' });

    expect(response.status).toBe(200);
    expect((await User.findById(owner.user._id))?.fullName).toBe('Owner Updated');
    expect((await User.findById(other.user._id))?.fullName).toBe('Candidate User');
  });

  it('rejects empty, unknown, privileged, and invalid profile values', async () => {
    const { authorization } = await createUser();
    const invalidBodies = [
      {},
      { role: 'ADMIN' },
      { passwordHash: 'injected' },
      { fullName: 'A' },
      { currentLevel: 'EXPERT' },
      { avatarUrl: 'javascript:alert(1)' },
      { githubUrl: 'ftp://github.com/user' },
      { linkedinUrl: 'not-a-url' },
    ];

    for (const body of invalidBodies) {
      const response = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', authorization)
        .send(body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('clears optional fields with null', async () => {
    const { user, authorization } = await createUser();
    await User.updateOne(
      { _id: user._id },
      {
        avatarUrl: 'https://cdn.example.com/avatar.png',
        currentLevel: 'LEAD',
        githubUrl: 'https://github.com/user',
        linkedinUrl: 'https://linkedin.com/in/user',
      }
    );

    const response = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', authorization)
      .send({ avatarUrl: null, currentLevel: null, githubUrl: null, linkedinUrl: null });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      avatarUrl: null,
      currentLevel: null,
      githubUrl: null,
      linkedinUrl: null,
    });
  });

  describe('POST /api/v1/profile/avatar', () => {
    it('requires authentication', async () => {
      const response = await request(app).post('/api/v1/profile/avatar');
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('rejects upload without an avatar file', async () => {
      const { authorization } = await createUser();
      const response = await request(app)
        .post('/api/v1/profile/avatar')
        .set('Authorization', authorization);

      expect(response.status).toBe(400);
    });

    it('rejects unsupported file extensions', async () => {
      const { authorization } = await createUser();
      const response = await request(app)
        .post('/api/v1/profile/avatar')
        .set('Authorization', authorization)
        .attach('avatar', Buffer.from('fake pdf content'), 'test.pdf');

      expect(response.status).toBe(400);
    });

    it('successfully uploads an image and updates user avatarUrl', async () => {
      const { user, authorization } = await createUser();
      // 1x1 transparent PNG buffer
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

      const response = await request(app)
        .post('/api/v1/profile/avatar')
        .set('Authorization', authorization)
        .attach('avatar', pngBuffer, 'avatar.png');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.avatarUrl).toMatch(/\/uploads\/avatars\/avatar-/);
      expect(response.body.data.user.avatarUrl).toBe(response.body.data.avatarUrl);

      // Verify DB persistence
      const updatedUser = await User.findById(user._id);
      expect(updatedUser?.avatarUrl).toBe(response.body.data.avatarUrl);
    });
  });
});

