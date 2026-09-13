import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { container } from 'tsyringe';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'question_bank_phase4_access_secret_32_chars_123';
  process.env.JWT_REFRESH_SECRET = 'question_bank_phase4_refresh_secret_32_chars_456';
  process.env.PASSWORD_RESET_SECRET = 'question_bank_phase4_reset_secret_32_chars_789';
});

import '../src/config/di';
import { QuestionBankService } from '../src/services/question-bank.service';
import Question from '../src/models/question.model';
import QuestionVersion from '../src/models/question-version.model';
import { QuestionEmbeddingModel } from '../src/models/question-embedding.model';
import Role from '../src/models/role.model';
import Level from '../src/models/level.model';
import { OutboxEventModel } from '../src/models/outbox-event.model';
import { createQuestionVersionEtag } from '../src/domain/question-bank/etag';
import { QuestionBankDomainError } from '../src/domain/question-bank/errors';

let replicaSet: MongoMemoryReplSet;

describe('AIP-65 Question Bank Phase 4 Integration', () => {
  let service: QuestionBankService;
  let testRoleId: string;
  let testLevelId: string;
  const adminActorId = new Types.ObjectId().toString();

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replicaSet.getUri(), {
      dbName: 'question_bank_phase4_integration_test',
    });
    service = container.resolve(QuestionBankService);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replicaSet.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();

    const role = await Role.create({
      code: 'BACKEND',
      name: 'Backend Developer',
      description: 'Backend role',
      status: 'ACTIVE',
    });
    testRoleId = role.id;

    const level = await Level.create({
      code: 'SENIOR',
      name: 'Senior',
      description: 'Senior level',
      status: 'ACTIVE',
    });
    testLevelId = level.id;
  });

  const createSampleDraft = async (promptVi: string | null = 'Câu hỏi thử nghiệm', promptEn: string | null = null) => {
    return service.createQuestion(
      {
        content: {
          prompt: { vi: promptVi, en: promptEn },
          explanation: { vi: 'Giải thích tiếng Việt', en: null },
        },
        classification: {
          primaryRoleId: testRoleId,
          levelIds: [testLevelId],
          technologyAgnostic: true,
          classificationComplete: true,
          topic: 'Architecture',
          tags: ['backend', 'microservices'],
          difficulty: 'MEDIUM',
          type: 'TECHNICAL',
        },
      },
      {
        actorId: adminActorId,
        idempotencyKey: 'idemp-create-' + new Types.ObjectId().toString(),
        route: '/api/v1/admin/question-bank/questions',
      }
    );
  };

  describe('Workstream 2: AI-Assisted Bilingual Translation', () => {
    it('preview translation returns proposed translations without mutating database', async () => {
      const created = await createSampleDraft('Giải thích Microservices');
      const questionId = created.data.question.id;
      const versionNumber = 1;

      const preview = await service.previewTranslation(
        questionId,
        versionNumber,
        {
          sourceLocale: 'vi',
          targetLocale: 'en',
          fields: ['prompt', 'explanation'],
        },
        'req-preview-1'
      );

      expect(preview.sourceLocale).toBe('vi');
      expect(preview.targetLocale).toBe('en');
      expect(preview.proposed.prompt).toContain('[EN]');
      expect(preview.fields.find((f) => f.field === 'prompt')?.wouldOverwrite).toBe(false);

      // Verify DB was NOT mutated
      const versionDoc = await QuestionVersion.findOne({
        questionId: new Types.ObjectId(questionId),
        versionNumber,
      });
      expect(versionDoc?.prompt.en).toBeNull();
      expect(versionDoc?.revision).toBe(0);
    });

    it('preview marks wouldOverwrite = true when target field already contains text', async () => {
      const created = await createSampleDraft('Câu hỏi VI', 'Existing English prompt');
      const questionId = created.data.question.id;

      const preview = await service.previewTranslation(
        questionId,
        1,
        {
          sourceLocale: 'vi',
          targetLocale: 'en',
          fields: ['prompt'],
        },
        'req-preview-2'
      );

      const promptField = preview.fields.find((f) => f.field === 'prompt');
      expect(promptField?.wouldOverwrite).toBe(true);
    });

    it('throws QUESTION_TRANSLATION_SOURCE_MISSING when requested source fields are empty', async () => {
      const created = await createSampleDraft(null, 'English only prompt');
      const questionId = created.data.question.id;

      await expect(
        service.previewTranslation(
          questionId,
          1,
          {
            sourceLocale: 'vi',
            targetLocale: 'en',
            fields: ['prompt'],
          },
          'req-preview-fail'
        )
      ).rejects.toThrowError(
        expect.objectContaining({ code: 'QUESTION_TRANSLATION_SOURCE_MISSING' })
      );
    });

    it('apply translation requires confirmOverwrite when target field has existing content', async () => {
      const created = await createSampleDraft('Câu hỏi VI', 'Existing English prompt');
      const questionId = created.data.question.id;
      const draftVersion = created.data.draftVersion!;

      await expect(
        service.applyTranslation(
          questionId,
          1,
          {
            sourceLocale: 'vi',
            targetLocale: 'en',
            fields: ['prompt'],
            confirmOverwrite: false,
            translations: {
              prompt: 'Overwritten prompt',
            },
          },
          { resourceId: draftVersion.id, revision: draftVersion.revision },
          {
            actorId: adminActorId,
            idempotencyKey: 'idemp-apply-overwrite-fail',
            route: '/apply',
          }
        )
      ).rejects.toThrowError(
        expect.objectContaining({
          code: 'QUESTION_TRANSLATION_OVERWRITE_CONFIRMATION_REQUIRED',
        })
      );
    });

    it('apply translation updates ONLY selected targetLocale fields, leaves sourceLocale untouched', async () => {
      const created = await createSampleDraft('Nguyên bản tiếng Việt');
      const questionId = created.data.question.id;
      const draftVersion = created.data.draftVersion!;

      const result = await service.applyTranslation(
        questionId,
        1,
        {
          sourceLocale: 'vi',
          targetLocale: 'en',
          fields: ['prompt'],
          confirmOverwrite: false,
          translations: {
            prompt: 'Translated English prompt',
          },
        },
        { resourceId: draftVersion.id, revision: draftVersion.revision },
        {
          actorId: adminActorId,
          idempotencyKey: 'idemp-apply-success-1',
          route: '/apply',
        }
      );

      expect(result.data.content.prompt.vi).toBe('Nguyên bản tiếng Việt');
      expect(result.data.content.prompt.en).toBe('Translated English prompt');
      expect(result.data.revision).toBe(1);

      // Verify outbox event emitted
      const outbox = await OutboxEventModel.findOne({
        aggregateId: new Types.ObjectId(questionId),
        eventType: 'QUESTION_VERSION_TRANSLATED',
      });
      expect(outbox).not.toBeNull();
      expect(outbox?.payload.targetLocale).toBe('en');
    });

    it('apply translation rejects when version is not DRAFT', async () => {
      const created = await createSampleDraft('Câu hỏi');
      const questionId = created.data.question.id;
      const draftVersion = created.data.draftVersion!;

      // Manually set status to APPROVED to test immutability
      await QuestionVersion.updateOne(
        { _id: new Types.ObjectId(draftVersion.id) },
        { $set: { status: 'APPROVED' } }
      );

      await expect(
        service.applyTranslation(
          questionId,
          1,
          {
            sourceLocale: 'vi',
            targetLocale: 'en',
            fields: ['prompt'],
            confirmOverwrite: true,
            translations: { prompt: 'English' },
          },
          { resourceId: draftVersion.id, revision: draftVersion.revision },
          {
            actorId: adminActorId,
            idempotencyKey: 'idemp-apply-immut',
            route: '/apply',
          }
        )
      ).rejects.toThrowError(
        expect.objectContaining({ code: 'QUESTION_VERSION_IMMUTABLE' })
      );
    });

    it('apply translation rejects on stale ETag / revision conflict', async () => {
      const created = await createSampleDraft('Câu hỏi');
      const questionId = created.data.question.id;
      const draftVersion = created.data.draftVersion!;

      await expect(
        service.applyTranslation(
          questionId,
          1,
          {
            sourceLocale: 'vi',
            targetLocale: 'en',
            fields: ['prompt'],
            confirmOverwrite: true,
            translations: { prompt: 'English' },
          },
          { resourceId: draftVersion.id, revision: 999 }, // wrong revision
          {
            actorId: adminActorId,
            idempotencyKey: 'idemp-apply-conflict',
            route: '/apply',
          }
        )
      ).rejects.toThrowError(
        expect.objectContaining({ code: 'QUESTION_REVISION_CONFLICT' })
      );
    });
  });

  describe('Workstream 3: Versioned Embedding Lifecycle & Backfill', () => {
    it('backfill embeddings processes published questions and skips existing READY records', async () => {
      // Create and publish a question
      const created = await createSampleDraft('Câu hỏi Published để backfill');
      const questionId = created.data.question.id;
      const draftVersion = created.data.draftVersion!;

      // Complete question fields & publish
      await QuestionVersion.updateOne(
        { _id: new Types.ObjectId(draftVersion.id) },
        {
          $set: {
            status: 'PUBLISHED',
            referenceAnswer: { vi: 'Đáp án chi tiết', en: null },
            learningObjective: { vi: 'Mục tiêu', en: null },
            rubric: [
              {
                key: 'tech',
                title: { vi: 'Tiêu chí 1', en: null },
                description: { vi: 'Mô tả', en: null },
                weight: 100,
                levels: [
                  { score: 0, description: { vi: 'Kém', en: null } },
                  { score: 4, description: { vi: 'Tốt', en: null } },
                ],
              },
            ],
          },
        }
      );
      await Question.updateOne(
        { _id: new Types.ObjectId(questionId) },
        { $set: { currentPublishedVersionId: new Types.ObjectId(draftVersion.id) } }
      );

      // Run backfill pass 1
      const backfillResult1 = await service.backfillEmbeddings(
        { batchSize: 10, forceRecompute: false },
        {
          actorId: adminActorId,
          idempotencyKey: 'idemp-backfill-1',
          route: '/backfill',
        }
      );

      expect(backfillResult1.readyCount).toBe(1);
      expect(backfillResult1.skippedCount).toBe(0);

      // Verify embedding stored in DB
      const stored = await QuestionEmbeddingModel.findOne({
        questionId: new Types.ObjectId(questionId),
        status: 'READY',
      });
      expect(stored).not.toBeNull();
      expect(stored?.vector).toHaveLength(768);

      // Run backfill pass 2 (idempotent, skips existing READY)
      const backfillResult2 = await service.backfillEmbeddings(
        { batchSize: 10, forceRecompute: false },
        {
          actorId: adminActorId,
          idempotencyKey: 'idemp-backfill-2',
          route: '/backfill',
        }
      );
      expect(backfillResult2.readyCount).toBe(0);
      expect(backfillResult2.skippedCount).toBe(1);
    });
  });

  describe('Workstream 4: Exact & Semantic Duplicate Detection', () => {
    it('detects exact and semantic duplicates, prioritizing EXACT matches and excluding self', async () => {
      // Question 1: Published
      const created1 = await createSampleDraft('Nguyên lý hoạt động của Garbage Collector trong V8 Engine');
      const q1Id = created1.data.question.id;
      const v1Id = created1.data.draftVersion!.id;

      await QuestionVersion.updateOne(
        { _id: new Types.ObjectId(v1Id) },
        {
          $set: {
            status: 'PUBLISHED',
            referenceAnswer: { vi: 'Chi tiết GC', en: null },
            learningObjective: { vi: 'Hiểu V8 GC', en: null },
            rubric: [
              {
                key: 'gc',
                title: { vi: 'GC', en: null },
                description: { vi: 'GC desc', en: null },
                weight: 100,
                levels: [
                  { score: 0, description: { vi: '0', en: null } },
                  { score: 4, description: { vi: '4', en: null } },
                ],
              },
            ],
          },
        }
      );
      await Question.updateOne(
        { _id: new Types.ObjectId(q1Id) },
        { $set: { currentPublishedVersionId: new Types.ObjectId(v1Id) } }
      );

      // Backfill embedding for Question 1
      await service.backfillEmbeddings(
        { batchSize: 10 },
        { actorId: adminActorId, idempotencyKey: 'idemp-backfill-dup-test', route: '/backfill' }
      );

      // Check duplicates using exact same prompt
      const resultExact = await service.detectSemanticDuplicates(
        {
          target: 'DRAFT',
          draft: {
            prompt: { vi: 'Nguyên lý hoạt động của Garbage Collector trong V8 Engine' },
            topic: 'Architecture',
            tags: ['backend'],
          },
          threshold: 0.7,
          topK: 5,
        },
        'req-dup-exact'
      );

      expect(resultExact.matches.length).toBeGreaterThan(0);
      const firstMatch = resultExact.matches[0];
      expect(firstMatch.questionId).toBe(q1Id);
      expect(firstMatch.matchType).toBe('EXACT');
      expect(firstMatch.similarityScore).toBe(1.0);

      // Self-match exclusion test:
      // When querying target: EXISTING for question 1, question 1 must NOT match itself!
      const resultSelf = await service.detectSemanticDuplicates(
        {
          target: 'EXISTING',
          questionId: q1Id,
          versionNumber: 1,
          threshold: 0.7,
          topK: 5,
        },
        'req-dup-self'
      );

      expect(resultSelf.matches.some((m) => m.questionId === q1Id)).toBe(false);
    });

    it('excludes retired questions from duplicate detection candidates', async () => {
      const created = await createSampleDraft('Câu hỏi đã bị retire');
      const qId = created.data.question.id;
      const vId = created.data.draftVersion!.id;

      await QuestionVersion.updateOne(
        { _id: new Types.ObjectId(vId) },
        { $set: { status: 'PUBLISHED' } }
      );
      await Question.updateOne(
        { _id: new Types.ObjectId(qId) },
        {
          $set: {
            currentPublishedVersionId: new Types.ObjectId(vId),
            lifecycleStatus: 'RETIRED',
          },
        }
      );

      const result = await service.detectSemanticDuplicates(
        {
          target: 'DRAFT',
          draft: {
            prompt: { vi: 'Câu hỏi đã bị retire' },
          },
          threshold: 0.5,
          topK: 5,
        },
        'req-dup-retired'
      );

      expect(result.matches.some((m) => m.questionId === qId)).toBe(false);
    });
  });

  describe('Isolation Boundary Invariant', () => {
    it('Interview runtime collections have zero documents', async () => {
      const db = mongoose.connection.db;
      if (db) {
        const interviewSessions = await db.collection('interviewsessions').countDocuments();
        const interviewQuestions = await db.collection('interviewquestions').countDocuments();
        expect(interviewSessions).toBe(0);
        expect(interviewQuestions).toBe(0);
      }
    });
  });
});
