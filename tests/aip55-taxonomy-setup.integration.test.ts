import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'aip55_access_secret_key_at_least_32_characters_123';
  process.env.JWT_REFRESH_SECRET = 'aip55_refresh_secret_key_at_least_32_characters_456';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
});

import app from '../src/app';
import User from '../src/models/user.model';
import Role from '../src/models/role.model';
import Level from '../src/models/level.model';
import Technology from '../src/models/technology.model';
import RefreshToken from '../src/models/refresh-token.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { PdfParser } from '../src/utils/parsers/PdfParser';
import {
  createTaxonomyFixture,
  createUserFixture,
  TaxonomyFixture,
  UserFixture,
} from './fixtures/aip55.factories';

let mongo: MongoMemoryReplSet;
let candidate: UserFixture;
let secondCandidate: UserFixture;
let admin: UserFixture;
let taxonomy: TaxonomyFixture;

const bearer = (fixture: UserFixture) => ({ Authorization: `Bearer ${fixture.accessToken}` });
const validSetup = () => ({
  jobPosition: taxonomy.role._id.toString(),
  level: taxonomy.level._id.toString(),
  techStacks: [taxonomy.technology._id.toString()],
  language: 'EN',
  secondsPerQuestion: 120,
  strategy: 'STANDARD',
});

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri('aip55_configuration'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  vi.restoreAllMocks();
  await Promise.all([
    User.deleteMany({}),
    RefreshToken.deleteMany({}),
    Role.deleteMany({}),
    Level.deleteMany({}),
    Technology.deleteMany({}),
    InterviewSessionModel.deleteMany({}),
    InterviewQuestionModel.deleteMany({}),
  ]);

  [candidate, secondCandidate, admin, taxonomy] = await Promise.all([
    createUserFixture(),
    createUserFixture(),
    createUserFixture({ role: 'ADMIN' }),
    createTaxonomyFixture(),
  ]);
});

describe('AIP-55 taxonomy contracts', () => {
  it('lists and filters isolated active taxonomy records with authenticated access', async () => {
    const roles = await request(app)
      .get(`/api/v1/roles?status=ACTIVE&code=${taxonomy.role.code}`)
      .set(bearer(candidate))
      .expect(200);
    const technologies = await request(app)
      .get(`/api/v1/technologies?status=ACTIVE&roleId=${taxonomy.role._id}`)
      .set(bearer(candidate))
      .expect(200);
    const levels = await request(app)
      .get(`/api/v1/levels?status=ACTIVE&code=${taxonomy.level.code}`)
      .set(bearer(candidate))
      .expect(200);

    expect(roles.body.data.roles, 'AIP-55 contract: code/status filter must return only the requested role')
      .toHaveLength(1);
    expect(roles.body.data.roles[0].code).toBe(taxonomy.role.code);
    expect(
      technologies.body.data.technologies.map((item: { _id: string }) => item._id),
      'AIP-55 contract: roleId filter must not leak unrelated technologies'
    ).toEqual([taxonomy.technology._id.toString()]);
    expect(levels.body.data.levels).toHaveLength(1);
    expect(levels.body.data.levels[0].code).toBe(taxonomy.level.code);
  });

  it('requires authentication for taxonomy reads', async () => {
    const response = await request(app).get('/api/v1/roles').expect(401);
    expect(response.body.code, 'AIP-55 contract: taxonomy reads require a live authenticated user')
      .toBe('AUTH_UNAUTHORIZED');
  });

  it('allows Admin mutation and rejects duplicate or malformed codes', async () => {
    const created = await request(app)
      .post('/api/v1/roles')
      .set(bearer(admin))
      .send({ code: 'aip55_new_role', name: 'Platform Engineer' })
      .expect(201);
    expect(created.body.data.code).toBe('AIP55_NEW_ROLE');

    await request(app)
      .post('/api/v1/roles')
      .set(bearer(admin))
      .send({ code: 'AIP55_NEW_ROLE', name: 'Duplicate' })
      .expect(400);

    const malformed = await request(app)
      .post('/api/v1/roles')
      .set(bearer(admin))
      .send({ code: 'bad code!', name: 'Invalid Code' })
      .expect(400);
    expect(malformed.body.code).toBe('VALIDATION_ERROR');
  });

  it('supports Admin create/read/update/soft-delete contracts for every taxonomy type', async () => {
    const createdRole = await request(app)
      .post('/api/v1/roles')
      .set(bearer(admin))
      .send({ code: 'AIP55_CRUD_ROLE', name: 'CRUD Role' })
      .expect(201);
    const createdLevel = await request(app)
      .post('/api/v1/levels')
      .set(bearer(admin))
      .send({ code: 'AIP55_CRUD_LEVEL', name: 'CRUD Level' })
      .expect(201);
    const createdTechnology = await request(app)
      .post('/api/v1/technologies')
      .set(bearer(admin))
      .send({
        code: 'AIP55_CRUD_TECH',
        name: 'CRUD Technology',
        roles: [createdRole.body.data._id],
        icon: 'https://cdn.example.test/aip55.svg',
      })
      .expect(201);

    const resources = [
      { path: 'roles', id: createdRole.body.data._id },
      { path: 'levels', id: createdLevel.body.data._id },
      { path: 'technologies', id: createdTechnology.body.data._id },
    ];
    for (const resource of resources) {
      await request(app)
        .get(`/api/v1/${resource.path}/${resource.id}`)
        .set(bearer(candidate))
        .expect(200);
      await request(app)
        .put(`/api/v1/${resource.path}/${resource.id}`)
        .set(bearer(admin))
        .send({ description: `Updated ${resource.path}` })
        .expect(200);
      await request(app)
        .delete(`/api/v1/${resource.path}/${resource.id}`)
        .set(bearer(admin))
        .expect(200);
    }

    expect((await Role.findById(createdRole.body.data._id))?.status).toBe('INACTIVE');
    expect((await Level.findById(createdLevel.body.data._id))?.status).toBe('INACTIVE');
    expect((await Technology.findById(createdTechnology.body.data._id))?.status).toBe('INACTIVE');
  });

  it('blocks Candidate taxonomy mutations without changing database state', async () => {
    const before = {
      roles: await Role.countDocuments(),
      levels: await Level.countDocuments(),
      technologies: await Technology.countDocuments(),
    };

    const responses = await Promise.all([
      request(app).post('/api/v1/roles').set(bearer(candidate)).send({ code: 'NOPE', name: 'Nope' }),
      request(app).put(`/api/v1/levels/${taxonomy.level._id}`).set(bearer(candidate)).send({ name: 'Forged' }),
      request(app).delete(`/api/v1/technologies/${taxonomy.technology._id}`).set(bearer(candidate)),
    ]);

    expect(
      responses.map((response) => response.status),
      'AIP-55 contract: Candidate must be forbidden from every taxonomy mutation'
    ).toEqual([403, 403, 403]);
    expect(await Role.countDocuments()).toBe(before.roles);
    expect(await Level.countDocuments()).toBe(before.levels);
    expect(await Technology.countDocuments()).toBe(before.technologies);
    expect((await Level.findById(taxonomy.level._id))?.name).toBe(taxonomy.level.name);
    expect((await Technology.findById(taxonomy.technology._id))?.status).toBe('ACTIVE');
  });

  it('enforces pagination boundaries without leaking an unbounded result', async () => {
    const firstPage = await request(app)
      .get('/api/v1/roles?page=1&limit=1')
      .set(bearer(candidate))
      .expect(200);
    const maxPage = await request(app)
      .get('/api/v1/roles?page=1&limit=1000')
      .set(bearer(candidate))
      .expect(200);
    const below = await request(app)
      .get('/api/v1/roles?page=0&limit=1')
      .set(bearer(candidate))
      .expect(400);
    const above = await request(app)
      .get('/api/v1/roles?page=1&limit=1001')
      .set(bearer(candidate))
      .expect(400);

    expect(firstPage.body.data.roles).toHaveLength(1);
    expect(maxPage.body.data.roles.length).toBe(await Role.countDocuments());
    expect([below.body.code, above.body.code]).toEqual(['VALIDATION_ERROR', 'VALIDATION_ERROR']);
  });

  it('rejects malformed taxonomy IDs before any repository CastError', async () => {
    const response = await request(app)
      .get('/api/v1/technologies/not-an-object-id')
      .set(bearer(candidate))
      .expect(400);
    expect(response.body.code, 'AIP-55 contract: malformed IDs use the canonical validation error')
      .toBe('VALIDATION_ERROR');
  });
});

describe('AIP-55 interview setup and ownership contracts', () => {
  it('persists a valid isolated setup using the authenticated owner and safe defaults', async () => {
    const response = await request(app)
      .post('/api/v1/interviews')
      .set(bearer(candidate))
      .send({
        jobPosition: taxonomy.role._id.toString(),
        level: taxonomy.level._id.toString(),
        techStacks: [taxonomy.technology._id.toString()],
      })
      .expect(201);

    const stored = await InterviewSessionModel.findById(response.body.data.id).lean();
    expect(stored?.userId, 'AIP-55 contract: owner comes only from the access-token identity')
      .toBe(candidate.user._id.toString());
    expect(stored?.setupData).toMatchObject({
      language: 'VI',
      secondsPerQuestion: 300,
      strategy: 'STANDARD',
    });
    expect(stored?.status).toBe('PENDING');
    expect(stored?.version).toBe(0);
  });

  const validMockJd = `
    Tuyển dụng Lập trình viên Backend NodeJS (Senior Developer).
    Mô tả công việc:
    - Phát triển API RESTful và Microservices sử dụng Node.js, TypeScript.
    - Làm việc với cơ sở dữ liệu MongoDB, Redis và tối ưu hóa hệ thống.
    Yêu cầu công việc:
    - Tối thiểu 3 năm kinh nghiệm lập trình backend với JavaScript, Node.js.
    - Hiểu biết sâu sắc về kiến trúc phần mềm, Docker và Git.
    Quyền lợi:
    - Mức lương cạnh tranh, chế độ đãi ngộ hấp dẫn.
  `.trim();

  it('accepts a valid JD setup without invoking an external service', async () => {
    const parser = vi.spyOn(PdfParser.prototype, 'parse').mockResolvedValueOnce(validMockJd);
    const response = await request(app)
      .post('/api/v1/interviews/generate-from-jd')
      .set(bearer(candidate))
      .field('language', 'EN')
      .field('secondsPerQuestion', '180')
      .field('strategy', 'STANDARD')
      .attach('jdFile', Buffer.from('%PDF-1.7 local fixture'), {
        filename: 'fixture.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(parser).toHaveBeenCalledOnce();
    expect(response.body.data.setupData.jdText).toBe(validMockJd);
    expect(response.body.data.userId).toBe(candidate.user._id.toString());
  });

  it('rejects JD setup with 422 INVALID_JD_CONTENT when file content is unrelated to JD', async () => {
    const unrelatedText = 'Hướng dẫn nấu phở bò: thịt bò, xương ống, ninh trong 6 tiếng, thêm quế hồi và hành lá chan nước dùng.';
    const parser = vi.spyOn(PdfParser.prototype, 'parse').mockResolvedValueOnce(unrelatedText);
    const response = await request(app)
      .post('/api/v1/interviews/generate-from-jd')
      .set(bearer(candidate))
      .field('language', 'VI')
      .attach('jdFile', Buffer.from('%PDF-1.7 local fixture'), {
        filename: 'recipe.pdf',
        contentType: 'application/pdf',
      })
      .expect(422);

    expect(parser).toHaveBeenCalledOnce();
    expect(response.body.code).toBe('INVALID_JD_CONTENT');
  });

  it('applies upload type and size boundaries after authentication', async () => {
    const unsupported = await request(app)
      .post('/api/v1/interviews/generate-from-jd')
      .set(bearer(candidate))
      .attach('jdFile', Buffer.from('plain text'), {
        filename: 'fixture.txt',
        contentType: 'text/plain',
      })
      .expect(415);
    const oversized = await request(app)
      .post('/api/v1/interviews/generate-from-jd')
      .set(bearer(candidate))
      .attach('jdFile', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'fixture.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);

    expect(unsupported.body.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(oversized.body.code).toBe('UPLOAD_TOO_LARGE');
  });

  it('rejects extra fields in JD setup before parsing the JD', async () => {
    const parser = vi.spyOn(PdfParser.prototype, 'parse');
    const response = await request(app)
      .post('/api/v1/interviews/generate-from-jd')
      .set(bearer(candidate))
      .field('techStacks', 'not-json')
      .attach('jdFile', Buffer.from('%PDF-1.7 local fixture'), {
        filename: 'fixture.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(parser, 'AIP-55 contract: invalid setup must fail before JD parsing').not.toHaveBeenCalled();
  });

  it('rejects forged owner and role fields without creating a session', async () => {
    for (const injectedField of [
      { userId: secondCandidate.user._id.toString() },
      { ownerId: secondCandidate.user._id.toString() },
      { role: 'ADMIN' },
    ]) {
      const response = await request(app)
        .post('/api/v1/interviews')
        .set(bearer(candidate))
        .send({ ...validSetup(), ...injectedField })
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    }

    expect(
      await InterviewSessionModel.countDocuments(),
      'AIP-55 contract: rejected ownership injection must have no persistence side effect'
    ).toBe(0);
  });

  it('allows owner reads and blocks cross-user IDOR and Admin bypass', async () => {
    const created = await request(app)
      .post('/api/v1/interviews')
      .set(bearer(candidate))
      .send(validSetup())
      .expect(201);
    const id = created.body.data.id;

    await request(app).get(`/api/v1/interviews/${id}`).set(bearer(candidate)).expect(200);
    const crossUser = await request(app)
      .get(`/api/v1/interviews/${id}`)
      .set(bearer(secondCandidate))
      .expect(403);
    const adminBypass = await request(app)
      .get(`/api/v1/interviews/${id}`)
      .set(bearer(admin))
      .expect(403);

    expect(crossUser.body.code).toBe('AUTH_FORBIDDEN');
    expect(adminBypass.body.code).toBe('AUTH_FORBIDDEN');
  });

  it('rejects missing, unknown, inactive, unrelated, duplicate, and excessive taxonomy input', async () => {
    const unknownId = new mongoose.Types.ObjectId().toString();
    const invalidPayloads: Array<{ payload: Record<string, unknown>; code: string }> = [
      { payload: { ...validSetup(), jobPosition: undefined }, code: 'VALIDATION_ERROR' },
      { payload: { ...validSetup(), jobPosition: unknownId }, code: 'SETUP_ROLE_INVALID' },
      { payload: { ...validSetup(), jobPosition: taxonomy.inactiveRole._id.toString() }, code: 'SETUP_ROLE_INVALID' },
      { payload: { ...validSetup(), level: taxonomy.inactiveLevel._id.toString() }, code: 'SETUP_LEVEL_INVALID' },
      { payload: { ...validSetup(), techStacks: [unknownId] }, code: 'SETUP_TECHNOLOGY_INVALID' },
      { payload: { ...validSetup(), techStacks: [taxonomy.inactiveTechnology._id.toString()] }, code: 'SETUP_TECHNOLOGY_INVALID' },
      { payload: { ...validSetup(), techStacks: [taxonomy.otherRoleTechnology._id.toString()] }, code: 'SETUP_TECHNOLOGY_INVALID' },
      { payload: { ...validSetup(), techStacks: [taxonomy.technology._id.toString(), taxonomy.technology._id.toString()] }, code: 'VALIDATION_ERROR' },
      { payload: { ...validSetup(), techStacks: Array.from({ length: 11 }, () => new mongoose.Types.ObjectId().toString()) }, code: 'VALIDATION_ERROR' },
    ];

    for (const { payload, code } of invalidPayloads) {
      const response = await request(app)
        .post('/api/v1/interviews')
        .set(bearer(candidate))
        .send(payload)
        .expect(400);
      expect(response.body.code, `AIP-55 contract: invalid setup must fail with ${code}`).toBe(code);
    }

    expect(await InterviewSessionModel.countDocuments()).toBe(0);
  });

  it('enforces timer, language, and strategy boundaries', async () => {
    for (const payload of [
      { ...validSetup(), secondsPerQuestion: 59 },
      { ...validSetup(), secondsPerQuestion: 601 },
      { ...validSetup(), secondsPerQuestion: 60.5 },
      { ...validSetup(), language: 'FR' },
      { ...validSetup(), strategy: 'RANDOM' },
    ]) {
      const response = await request(app)
        .post('/api/v1/interviews')
        .set(bearer(candidate))
        .send(payload)
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    }

    const disabled = await request(app)
      .post('/api/v1/interviews')
      .set(bearer(candidate))
      .send({ ...validSetup(), strategy: 'ADAPTIVE' })
      .expect(409);
    expect(disabled.body.code).toBe('FEATURE_DISABLED');

    for (const secondsPerQuestion of [60, 600]) {
      await request(app)
        .post('/api/v1/interviews')
        .set(bearer(candidate))
        .send({ ...validSetup(), secondsPerQuestion })
        .expect(201);
    }
  });

  it('rejects malformed session IDs with a canonical 400 instead of a database error', async () => {
    const response = await request(app)
      .get('/api/v1/interviews/not-an-object-id')
      .set(bearer(candidate))
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
