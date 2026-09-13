import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'question_bank_access_secret_at_least_32_characters';
  process.env.JWT_REFRESH_SECRET = 'question_bank_refresh_secret_at_least_32_characters';
  process.env.PASSWORD_RESET_SECRET = 'question_bank_password_reset_secret_at_least_32_characters';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
  process.env.QUESTION_BANK_ADMIN_API_ENABLED = 'true';
});

import app from '../src/app';
import User from '../src/models/user.model';
import Role from '../src/models/role.model';
import Level from '../src/models/level.model';
import Technology from '../src/models/technology.model';
import Question from '../src/models/question.model';
import QuestionVersion from '../src/models/question-version.model';
import QuestionReview from '../src/models/question-review.model';
import QuestionCounter from '../src/models/question-counter.model';
import IdempotencyRecord from '../src/models/idempotency-record.model';
import OutboxEvent from '../src/models/outbox-event.model';
import { generateAuthTokens } from '../src/utils/token';

const BASE = '/api/v1/admin/question-bank/questions';
const IDEMPOTENCY_KEY = 'qb-integration-create-0001';

let replicaSet: MongoMemoryReplSet;
let adminToken: string;
let reviewerToken: string;
let candidateToken: string;
let adminId: string;
let roleId: string;
let levelId: string;
let technologyId: string;

const auth = (token = adminToken) => ({ Authorization: 'Bearer ' + token });

const authoringPayload = () => ({
  content: {
    prompt: { vi: 'Giải thích event loop trong Node.js', en: 'Explain the Node.js event loop' },
    explanation: { vi: 'Câu hỏi kiểm tra nền tảng runtime', en: 'Runtime fundamentals' },
  },
  classification: {
    primaryRoleId: roleId,
    additionalRoleIds: [],
    levelIds: [levelId],
    technologies: [{ technologyId, relevance: 100 }],
    technologyAgnostic: false,
    classificationComplete: true,
    topic: 'Node.js runtime',
    tags: ['node-js', 'event-loop'],
    difficulty: 'MEDIUM',
    type: 'TECHNICAL',
  },
  answer: {
    referenceAnswer: { vi: 'Event loop điều phối các phase và callback.', en: 'The event loop coordinates phases and callbacks.' },
    learningObjective: { vi: 'Hiểu mô hình bất đồng bộ.', en: 'Understand the asynchronous model.' },
    estimatedTimeSeconds: 300,
    followUps: [{ vi: 'Microtask chạy khi nào?', en: 'When do microtasks run?' }],
  },
  rubric: [
    {
      key: 'core-concepts',
      title: { vi: 'Khái niệm cốt lõi', en: 'Core concepts' },
      description: { vi: 'Độ chính xác', en: 'Accuracy' },
      weight: 60,
      levels: [
        { score: 0, description: { vi: 'Chưa đạt', en: 'Missing' } },
        { score: 4, description: { vi: 'Đầy đủ', en: 'Complete' } },
      ],
    },
    {
      key: 'communication',
      title: { vi: 'Trình bày', en: 'Communication' },
      description: { vi: 'Độ rõ ràng', en: 'Clarity' },
      weight: 40,
      levels: [
        { score: 0, description: { vi: 'Khó hiểu', en: 'Unclear' } },
        { score: 4, description: { vi: 'Rõ ràng', en: 'Clear' } },
      ],
    },
  ],
  changeSummary: 'Khởi tạo câu hỏi',
});

const createQuestion = async (key = IDEMPOTENCY_KEY) =>
  request(app)
    .post(BASE)
    .set(auth())
    .set('Idempotency-Key', key)
    .set('X-Request-Id', '123e4567-e89b-42d3-a456-426614174000')
    .send(authoringPayload());

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri(), {
    dbName: 'question_bank_disposable_integration_test',
  });
  await Promise.all([
    Question.init(),
    QuestionVersion.init(),
    QuestionReview.init(),
    QuestionCounter.init(),
    IdempotencyRecord.init(),
    OutboxEvent.init(),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

beforeEach(async () => {
  process.env.QUESTION_BANK_ADMIN_API_ENABLED = 'true';
  await Promise.all([
    OutboxEvent.deleteMany({}),
    IdempotencyRecord.deleteMany({}),
    QuestionReview.deleteMany({}),
    QuestionVersion.deleteMany({}),
    Question.deleteMany({}),
    QuestionCounter.deleteMany({}),
    Technology.deleteMany({}),
    Level.deleteMany({}),
    Role.deleteMany({}),
    User.deleteMany({}),
  ]);

  const [admin, reviewer, candidate, role, level] = await Promise.all([
    User.create({
      email: 'qb-reviewer@example.test',
      passwordHash: 'not-used-by-integration-test',
      fullName: 'Question Bank Reviewer',
      role: 'ADMIN',
      status: 'ACTIVE',
      credentialVersion: 0,
    }),
    User.create({
      email: 'qb-admin@example.test',
      passwordHash: 'not-used-by-integration-test',
      fullName: 'Question Bank Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      credentialVersion: 0,
    }),
    User.create({
      email: 'qb-candidate@example.test',
      passwordHash: 'not-used-by-integration-test',
      fullName: 'Question Bank Candidate',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      credentialVersion: 0,
    }),
    Role.create({ code: 'BACKEND', name: 'Backend Developer', status: 'ACTIVE' }),
    Level.create({ code: 'JUNIOR', name: 'Junior', status: 'ACTIVE' }),
  ]);
  const technology = await Technology.create({
    code: 'NODEJS',
    name: 'Node.js',
    roles: [role._id],
    status: 'ACTIVE',
  });

  adminId = admin._id.toString();
  roleId = role._id.toString();
  levelId = level._id.toString();
  technologyId = technology._id.toString();
  adminToken = generateAuthTokens(adminId, 'ADMIN').accessToken;
  reviewerToken = generateAuthTokens(reviewer._id.toString(), 'ADMIN').accessToken;
  candidateToken = generateAuthTokens(candidate._id.toString(), 'CANDIDATE').accessToken;
});

describe('AIP-62 Question Bank API integration', () => {
  it('fails closed for unauthenticated, non-admin, and disabled feature requests', async () => {
    const unauthenticated = await request(app).get(BASE);
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.code).toBe('AUTH_UNAUTHORIZED');
    expect(unauthenticated.body.requestId).toMatch(/^[0-9a-f-]{36}$/i);

    const forbidden = await request(app).get(BASE).set(auth(candidateToken));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('AUTH_FORBIDDEN');

    const malformedJson = await request(app)
      .post(BASE)
      .set('Content-Type', 'application/json')
      .send('{"content":');
    expect(malformedJson.status).toBe(400);
    expect(malformedJson.headers['cache-control']).toContain('no-store');
    expect(malformedJson.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);

    process.env.QUESTION_BANK_ADMIN_API_ENABLED = 'false';
    const disabled = await request(app).get(BASE).set(auth());
    expect(disabled.status).toBe(404);
    expect(disabled.body.code).toBe('QUESTION_BANK_FEATURE_DISABLED');
    expect(disabled.headers['cache-control']).toContain('no-store');
  });

  it('creates the aggregate atomically and exposes only the admin DTO contract', async () => {
    const response = await createQuestion();

    expect(response.status).toBe(201);
    expect(response.headers['x-request-id']).toBe('123e4567-e89b-42d3-a456-426614174000');
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.headers.etag).toMatch(/^W\/"question-version:[a-f\d]{24}:0"$/);
    expect(response.body.requestId).toBe('123e4567-e89b-42d3-a456-426614174000');
    expect(response.body.data.question.code).toMatch(/^QB-\d{4}-000001$/);
    expect(response.body.data.question.ownerId).toBe(adminId);
    expect(response.body.data.draftVersion.content.prompt.vi).toContain('event loop');
    expect(response.body.data.draftVersion).not.toHaveProperty('contentHash');
    expect(response.body.data.draftVersion).not.toHaveProperty('normalizedPromptFingerprint');

    expect(await Question.countDocuments()).toBe(1);
    expect(await QuestionVersion.countDocuments()).toBe(1);
    expect(await IdempotencyRecord.countDocuments({ status: 'COMPLETED' })).toBe(1);
    expect(await OutboxEvent.countDocuments({ eventType: 'QUESTION_CREATED' })).toBe(1);
  });

  it('replays the same idempotent request and rejects reuse with another payload', async () => {
    const first = await createQuestion();
    const replay = await createQuestion();

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body.data.question.id).toBe(first.body.data.question.id);
    expect(await Question.countDocuments()).toBe(1);
    expect(await OutboxEvent.countDocuments()).toBe(1);

    const changed = authoringPayload();
    changed.content.prompt.vi = 'Payload khác';
    const conflict = await request(app)
      .post(BASE)
      .set(auth())
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send(changed);
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('collapses concurrent requests with the same idempotency key to one aggregate', async () => {
    const key = 'qb-integration-concurrent-0001';
    const [first, second] = await Promise.all([
      createQuestion(key),
      createQuestion(key),
    ]);

    expect([first.status, second.status]).toEqual([201, 201]);
    expect(first.body.data.question.id).toBe(second.body.data.question.id);
    expect(
      [first.headers['idempotency-replayed'], second.headers['idempotency-replayed']]
        .filter(Boolean)
    ).toEqual(['true']);
    expect(await Question.countDocuments()).toBe(1);
    expect(await QuestionVersion.countDocuments()).toBe(1);
    expect(await OutboxEvent.countDocuments()).toBe(1);
  });

  it('rolls back the aggregate, idempotency claim, counter, and outbox on failure', async () => {
    const outboxFailure = vi
      .spyOn(OutboxEvent, 'create')
      .mockRejectedValueOnce(new Error('forced disposable integration failure'));

    const response = await createQuestion('qb-integration-rollback-0001');
    outboxFailure.mockRestore();

    expect(response.status).toBe(500);
    expect(await Question.countDocuments()).toBe(0);
    expect(await QuestionVersion.countDocuments()).toBe(0);
    expect(await IdempotencyRecord.countDocuments()).toBe(0);
    expect(await QuestionCounter.countDocuments()).toBe(0);
    expect(await OutboxEvent.countDocuments()).toBe(0);
  });

  it('validates meaningful input and taxonomy references before a transaction starts', async () => {
    const empty = await request(app)
      .post(BASE)
      .set(auth())
      .set('Idempotency-Key', 'qb-integration-empty-0001')
      .send({
        content: { prompt: { vi: '', en: '' } },
        classification: { technologyAgnostic: false, classificationComplete: false },
        rubric: [],
        changeSummary: '',
      });
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('VALIDATION_ERROR');

    const invalidTaxonomy = authoringPayload();
    invalidTaxonomy.classification.primaryRoleId = new mongoose.Types.ObjectId().toString();
    const invalid = await request(app)
      .post(BASE)
      .set(auth())
      .set('Idempotency-Key', 'qb-integration-taxonomy-0001')
      .send(invalidTaxonomy);
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.errors[0].field).toBe('roleIds');
    expect(await Question.countDocuments()).toBe(0);
  });

  it('returns a safe list projection and enforces optimistic concurrency on Draft updates', async () => {
    const created = await createQuestion();
    const questionId = created.body.data.question.id as string;
    const draft = created.body.data.draftVersion;

    const listed = await request(app)
      .get(BASE + '?page=1&limit=20&search=event')
      .set(auth());
    expect(listed.status).toBe(200);
    expect(listed.body.data.items).toHaveLength(1);
    expect(listed.body.data.items[0].promptPreview.vi).toContain('event loop');
    expect(listed.body.data.items[0]).not.toHaveProperty('answer');
    expect(listed.body.data.items[0]).not.toHaveProperty('rubric');

    const missing = await request(app)
      .patch(BASE + '/' + questionId + '/versions/1')
      .set(auth())
      .set('Content-Type', 'application/merge-patch+json')
      .send({ changeSummary: 'Không có ETag' });
    expect(missing.status).toBe(428);
    expect(missing.body.code).toBe('PRECONDITION_REQUIRED');

    const updated = await request(app)
      .patch(BASE + '/' + questionId + '/versions/1')
      .set(auth())
      .set('Content-Type', 'application/merge-patch+json')
      .set('If-Match', created.headers.etag)
      .send({ content: { prompt: { vi: 'Event loop và microtask' } } });
    expect(updated.status).toBe(200);
    expect(updated.body.data.revision).toBe(1);
    expect(updated.headers.etag).toMatch(/:1"$/);
    expect(
      await OutboxEvent.countDocuments({ eventType: 'QUESTION_DRAFT_UPDATED' })
    ).toBe(1);

    const stale = await request(app)
      .patch(BASE + '/' + questionId + '/versions/1')
      .set(auth())
      .set('Content-Type', 'application/merge-patch+json')
      .set('If-Match', created.headers.etag)
      .send({ changeSummary: 'Ghi đè bằng revision cũ' });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('QUESTION_REVISION_CONFLICT');

    await QuestionVersion.updateOne({ _id: draft.id }, { $set: { status: 'PUBLISHED' } });
    const immutable = await request(app)
      .patch(BASE + '/' + questionId + '/versions/1')
      .set(auth())
      .set('Content-Type', 'application/merge-patch+json')
      .set('If-Match', updated.headers.etag)
      .send({ changeSummary: 'Không được phép' });
    expect(immutable.status).toBe(409);
    expect(immutable.body.code).toBe('QUESTION_VERSION_IMMUTABLE');
  });

  it('creates a new Draft from an immutable published snapshot with aggregate CAS', async () => {
    const created = await createQuestion('qb-integration-version-source');
    const questionId = created.body.data.question.id as string;
    const firstVersionId = created.body.data.draftVersion.id as string;

    await QuestionVersion.updateOne(
      { _id: firstVersionId },
      { $set: { status: 'PUBLISHED' } }
    );
    await Question.updateOne(
      { _id: questionId },
      {
        $set: {
          draftVersionId: null,
          currentPublishedVersionId: new mongoose.Types.ObjectId(firstVersionId),
        },
      }
    );

    const detail = await request(app).get(BASE + '/' + questionId).set(auth());
    expect(detail.status).toBe(200);
    expect(detail.headers.etag).toMatch(/^W\/"question:[a-f\d]{24}:0"$/);

    const next = await request(app)
      .post(BASE + '/' + questionId + '/versions')
      .set(auth())
      .set('If-Match', detail.headers.etag)
      .set('Idempotency-Key', 'qb-integration-create-version-0001')
      .send({
        sourceVersionNumber: 1,
        content: { prompt: { vi: 'Event loop phiên bản hai' } },
        changeSummary: 'Tạo Draft từ bản đã publish',
      });

    expect(next.status).toBe(201);
    expect(next.body.data.versionNumber).toBe(2);
    expect(next.body.data.status).toBe('DRAFT');
    expect(next.body.data.provenance.sourceVersionId).toBe(firstVersionId);
    expect(next.body.data.content.prompt.en).toBe('Explain the Node.js event loop');
    expect(await QuestionVersion.countDocuments({ questionId })).toBe(2);
    expect(await OutboxEvent.countDocuments({ eventType: 'QUESTION_VERSION_CREATED' })).toBe(1);
  });

  it('runs submit, four-eyes review, publish, retire and restore atomically', async () => {
    const created = await createQuestion('qb-phase2-governed-flow-0001');
    const questionId = created.body.data.question.id as string;
    const versionId = created.body.data.draftVersion.id as string;

    const submitted = await request(app)
      .post(`${BASE}/${questionId}/submit-review`)
      .set(auth())
      .set('If-Match', created.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-submit-review-0001')
      .send({ reason: 'Sẵn sàng review' });
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.status).toBe('IN_REVIEW');

    const submittedReplay = await request(app)
      .post(`${BASE}/${questionId}/submit-review`)
      .set(auth())
      .set('If-Match', created.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-submit-review-0001')
      .send({ reason: 'Sẵn sàng review' });
    expect(submittedReplay.status).toBe(200);
    expect(submittedReplay.headers['idempotency-replayed']).toBe('true');
    expect(await QuestionReview.countDocuments({ questionId, action: 'SUBMIT' })).toBe(1);

    const selfApproval = await request(app)
      .post(`/api/v1/admin/question-bank/reviews/${versionId}/decision`)
      .set(auth())
      .set('If-Match', submitted.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-self-approve-0001')
      .send({ decision: 'APPROVE' });
    expect(selfApproval.status).toBe(409);
    expect(selfApproval.body.code).toBe('QUESTION_FOUR_EYES_VIOLATION');

    const queue = await request(app)
      .get('/api/v1/admin/question-bank/reviews?status=IN_REVIEW')
      .set(auth(reviewerToken));
    expect(queue.status).toBe(200);
    expect(queue.body.data.items).toHaveLength(1);
    expect(JSON.stringify(queue.body.data.items)).not.toContain('referenceAnswer');
    expect(JSON.stringify(queue.body.data.items)).not.toContain('rubric');

    const reviewDetail = await request(app)
      .get(`/api/v1/admin/question-bank/reviews/${versionId}`)
      .set(auth(reviewerToken));
    expect(reviewDetail.status).toBe(200);
    expect(reviewDetail.body.data.allowedActions).toContain('APPROVE');
    expect(reviewDetail.body.data.completenessErrors).toEqual([]);
    expect(reviewDetail.body.data.history[0].action).toBe('SUBMIT');

    const approved = await request(app)
      .post(`/api/v1/admin/question-bank/reviews/${versionId}/decision`)
      .set(auth(reviewerToken))
      .set('If-Match', reviewDetail.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-approve-review-0001')
      .send({ decision: 'APPROVE', reason: 'Đạt tiêu chuẩn' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.snapshot.status).toBe('APPROVED');

    const approvedReplay = await request(app)
      .post(`/api/v1/admin/question-bank/reviews/${versionId}/decision`)
      .set(auth(reviewerToken))
      .set('If-Match', reviewDetail.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-approve-review-0001')
      .send({ decision: 'APPROVE', reason: 'Đạt tiêu chuẩn' });
    expect(approvedReplay.status).toBe(200);
    expect(approvedReplay.headers['idempotency-replayed']).toBe('true');
    expect(await QuestionReview.countDocuments({ questionId, action: 'APPROVE' })).toBe(1);

    const published = await request(app)
      .post(`${BASE}/${questionId}/versions/1/publish`)
      .set(auth(reviewerToken))
      .set('If-Match', approved.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-publish-version-0001')
      .send({ reason: 'Xuất bản lần đầu' });
    expect(published.status).toBe(200);
    expect(published.body.data.status).toBe('PUBLISHED');

    const publishedReplay = await request(app)
      .post(`${BASE}/${questionId}/versions/1/publish`)
      .set(auth(reviewerToken))
      .set('If-Match', approved.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-publish-version-0001')
      .send({ reason: 'Xuất bản lần đầu' });
    expect(publishedReplay.status).toBe(200);
    expect(publishedReplay.headers['idempotency-replayed']).toBe('true');

    const aggregate = await Question.findById(questionId);
    expect(aggregate?.draftVersionId).toBeNull();
    expect(aggregate?.currentPublishedVersionId?.toString()).toBe(versionId);
    expect(await QuestionVersion.countDocuments({ questionId, status: 'PUBLISHED' })).toBe(1);
    expect(await QuestionReview.countDocuments({ questionId })).toBe(3);
    expect(await OutboxEvent.countDocuments({ eventType: 'QUESTION_PUBLISHED' })).toBe(1);

    const fresh = await request(app).get(`${BASE}/${questionId}`).set(auth(reviewerToken));
    const retired = await request(app)
      .post(`${BASE}/${questionId}/retire`)
      .set(auth(reviewerToken))
      .set('If-Match', fresh.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-retire-question-0001')
      .send({ reason: 'Tạm ngừng sử dụng' });
    expect(retired.status).toBe(200);
    expect(retired.body.data.question.lifecycleStatus).toBe('RETIRED');

    const replay = await request(app)
      .post(`${BASE}/${questionId}/retire`)
      .set(auth(reviewerToken))
      .set('If-Match', fresh.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-retire-question-0001')
      .send({ reason: 'Tạm ngừng sử dụng' });
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(await QuestionReview.countDocuments({ questionId, action: 'RETIRE' })).toBe(1);

    const restored = await request(app)
      .post(`${BASE}/${questionId}/restore`)
      .set(auth(reviewerToken))
      .set('If-Match', retired.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-restore-question-0001')
      .send({ reason: 'Đã sẵn sàng hoạt động lại' });
    expect(restored.status).toBe(200);
    expect(restored.body.data.question.lifecycleStatus).toBe('ACTIVE');

    const secondDraft = await request(app)
      .post(`${BASE}/${questionId}/versions`)
      .set(auth())
      .set('If-Match', restored.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-second-draft-0001')
      .send({
        sourceVersionNumber: 1,
        content: { prompt: { vi: 'Giải thích event loop phiên bản hai' } },
        answer: { referenceAnswer: { vi: 'Event loop phiên bản hai.' } },
        changeSummary: 'Bản thay thế đã qua governance',
      });
    expect(secondDraft.status).toBe(201);

    const secondSubmitted = await request(app)
      .post(`${BASE}/${questionId}/submit-review`)
      .set(auth())
      .set('If-Match', secondDraft.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-second-submit-0001')
      .send({ reason: 'Gửi bản thay thế' });
    expect(secondSubmitted.status).toBe(200);

    const secondApproved = await request(app)
      .post(`/api/v1/admin/question-bank/reviews/${secondDraft.body.data.id}/decision`)
      .set(auth(reviewerToken))
      .set('If-Match', secondSubmitted.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-second-approve-0001')
      .send({ decision: 'APPROVE', reason: 'Đạt tiêu chuẩn' });
    expect(secondApproved.status).toBe(200);

    const secondPublished = await request(app)
      .post(`${BASE}/${questionId}/versions/2/publish`)
      .set(auth(reviewerToken))
      .set('If-Match', secondApproved.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-second-publish-0001')
      .send({ reason: 'Thay thế bản một' });
    expect(secondPublished.status).toBe(200);
    expect(secondPublished.body.data.status).toBe('PUBLISHED');
    expect(await QuestionVersion.countDocuments({ questionId, status: 'PUBLISHED' })).toBe(1);
    expect(await QuestionVersion.countDocuments({ questionId, status: 'SUPERSEDED' })).toBe(1);
    expect(await OutboxEvent.countDocuments({ aggregateId: questionId, eventType: 'QUESTION_SUPERSEDED' })).toBe(1);
  });

  it('rejects incomplete submit and makes concurrent submit CAS-safe', async () => {
    const incomplete = await request(app)
      .post(BASE)
      .set(auth())
      .set('Idempotency-Key', 'qb-phase2-incomplete-create-0001')
      .send({ content: { prompt: { vi: 'Thiếu answer và rubric' } } });
    const incompleteSubmit = await request(app)
      .post(`${BASE}/${incomplete.body.data.question.id}/submit-review`)
      .set(auth())
      .set('If-Match', incomplete.headers.etag)
      .set('Idempotency-Key', 'qb-phase2-incomplete-submit-0001')
      .send({});
    expect(incompleteSubmit.status).toBe(409);
    expect(incompleteSubmit.body.code).toBe('QUESTION_CONTENT_INCOMPLETE');
    expect(incompleteSubmit.body.errors.length).toBeGreaterThan(1);

    const created = await createQuestion('qb-phase2-concurrent-create-0001');
    const questionId = created.body.data.question.id as string;
    const calls = await Promise.all([
      request(app)
        .post(`${BASE}/${questionId}/submit-review`)
        .set(auth())
        .set('If-Match', created.headers.etag)
        .set('Idempotency-Key', 'qb-phase2-concurrent-submit-a')
        .send({}),
      request(app)
        .post(`${BASE}/${questionId}/submit-review`)
        .set(auth())
        .set('If-Match', created.headers.etag)
        .set('Idempotency-Key', 'qb-phase2-concurrent-submit-b')
        .send({}),
    ]);
    expect(calls.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await QuestionReview.countDocuments({ questionId, action: 'SUBMIT' })).toBe(1);
    expect(await OutboxEvent.countDocuments({ aggregateId: questionId, eventType: 'QUESTION_SUBMITTED' })).toBe(1);
  });

  it('declares the required uniqueness and read-path indexes', async () => {
    const questionIndexes = await Question.collection.indexes();
    const versionIndexes = await QuestionVersion.collection.indexes();
    const reviewIndexes = await QuestionReview.collection.indexes();
    const idempotencyIndexes = await IdempotencyRecord.collection.indexes();
    const outboxIndexes = await OutboxEvent.collection.indexes();

    expect(questionIndexes.map((index) => index.name)).toContain('questions_code_unique');
    expect(versionIndexes.map((index) => index.name)).toContain(
      'question_versions_question_number_unique'
    );
    expect(versionIndexes.map((index) => index.name)).toContain(
      'question_versions_one_active_draft'
    );
    expect(versionIndexes.map((index) => index.name)).toContain(
      'question_versions_one_published'
    );
    expect(versionIndexes.map((index) => index.name)).toContain(
      'question_versions_review_queue'
    );
    expect(reviewIndexes.map((index) => index.name)).toContain(
      'question_reviews_version_revision_actor'
    );
    expect(idempotencyIndexes.map((index) => index.name)).toContain(
      'idempotency_scope_route_actor_key_unique'
    );
    expect(idempotencyIndexes.map((index) => index.name)).toContain(
      'idempotency_expires_ttl'
    );
    expect(outboxIndexes.map((index) => index.name)).toContain(
      'outbox_status_next_attempt'
    );
  });
});
