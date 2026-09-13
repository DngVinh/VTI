import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { GenerateQuestionJobHandler } from '../src/domain/jobs/handlers/GenerateQuestionJobHandler';
import { QuestionBankSelector } from '../src/domain/interview/question-source/QuestionBankSelector';
import { InterviewQuestionGenerationOrchestrator } from '../src/domain/interview/question-source/InterviewQuestionGenerationOrchestrator';
import { toCandidateSafeInterviewQuestion, toCandidateSafeInterviewSession } from '../src/domain/interview/safe-dto';
import {
  semanticDuplicateSchema,
  translationApplySchema,
  questionVersionAuthoringSchema,
  embeddingBackfillSchema,
} from '../src/validators/question-bank.validator';
import Role from '../src/models/role.model';
import Level from '../src/models/level.model';
import Technology from '../src/models/technology.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { MongoInterviewRepository } from '../src/repositories/MongoInterviewRepository';
import { AppError } from '../src/utils/AppError';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'coverage_access_secret_at_least_32_characters_long';
  process.env.JWT_REFRESH_SECRET = 'coverage_refresh_secret_at_least_32_characters_long';
  process.env.PASSWORD_RESET_SECRET = 'coverage_reset_secret_at_least_32_characters_long';
});

describe('AIP-67 Phase 6 Coverage Qualification - Unit Suite', () => {
  describe('GenerateQuestionJobHandler Legacy Fallback Paths', () => {
    let mockAiProvider: any;
    let mockRepo: any;
    let mockEventPublisher: any;

    beforeEach(() => {
      mockAiProvider = {
        generateQuestions: vi.fn(),
      };
      mockRepo = {
        findById: vi.fn(),
        forOwner: vi.fn(),
        getOwnerId: vi.fn().mockReturnValue('507f1f77bcf86cd799439012'),
        createQuestions: vi.fn(),
        updateTokenUsage: vi.fn(),
        updateStatus: vi.fn(),
      };
      mockRepo.forOwner.mockReturnValue(mockRepo);
      mockEventPublisher = {
        publish: vi.fn(),
      };
    });

    it('processes operation jobs through the durable operation processor', async () => {
      const mockProcessor = { process: vi.fn().mockResolvedValue(undefined) };
      const handler = new GenerateQuestionJobHandler(
        mockProcessor as any,
        mockRepo,
        mockEventPublisher
      );

      await handler.handle({ operationId: '507f1f77bcf86cd799439011' });
      expect(mockProcessor.process).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'GENERATE_QUESTIONS');
      expect(mockRepo.findById).not.toHaveBeenCalled();
    });

    it('aborts legacy job when session is null', async () => {
      mockRepo.findById.mockResolvedValue(null);
      const handler = new GenerateQuestionJobHandler(
        mockAiProvider,
        mockRepo,
        mockEventPublisher,
        undefined
      );

      await handler.handle({ interviewId: '507f1f77bcf86cd799439011', ownerId: '507f1f77bcf86cd799439012' });
      expect(mockRepo.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockAiProvider.generateQuestions).not.toHaveBeenCalled();
    });

    it('aborts legacy job when session status is not GENERATING', async () => {
      mockRepo.findById.mockResolvedValue({ id: '507f1f77bcf86cd799439013', status: 'IN_PROGRESS' });
      const handler = new GenerateQuestionJobHandler(
        mockAiProvider,
        mockRepo,
        mockEventPublisher,
        undefined
      );

      await handler.handle({ interviewId: '507f1f77bcf86cd799439013', ownerId: '507f1f77bcf86cd799439012' });
      expect(mockRepo.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439013');
      expect(mockAiProvider.generateQuestions).not.toHaveBeenCalled();
    });

    it('generates, persists questions, and transitions state on legacy success', async () => {
      mockRepo.findById.mockResolvedValue({ id: '507f1f77bcf86cd799439014', status: 'GENERATING', setupData: { jobPosition: 'tech' } });
      mockAiProvider.generateQuestions.mockResolvedValue({
        data: [
          { order: 1, difficulty: 'Easy', category: 'Fundamentals', content: { vi: 'Q1 vi', en: 'Q1 en' } },
          { order: 2, difficulty: 'Medium', category: 'Fundamentals', content: { vi: 'Q2 vi', en: 'Q2 en' } },
          { order: 3, difficulty: 'Medium', category: 'Fundamentals', content: { vi: 'Q3 vi', en: 'Q3 en' } },
          { order: 4, difficulty: 'Hard', category: 'Fundamentals', content: { vi: 'Q4 vi', en: 'Q4 en' } },
          { order: 5, difficulty: 'Hard', category: 'Fundamentals', content: { vi: 'Q5 vi', en: 'Q5 en' } },
        ],
        audit: { promptTokenCount: 100, candidatesTokenCount: 200, totalTokenCount: 300 },
      });
      mockRepo.createQuestions.mockResolvedValue([]);
      mockRepo.updateTokenUsage.mockResolvedValue(undefined);

      const handler = new GenerateQuestionJobHandler(
        mockAiProvider,
        mockRepo,
        mockEventPublisher,
        undefined
      );

      await handler.handle({ interviewId: '507f1f77bcf86cd799439014', ownerId: '507f1f77bcf86cd799439012' });
      expect(mockAiProvider.generateQuestions).toHaveBeenCalledWith({ jobPosition: 'tech', techStacks: [] });
      expect(mockRepo.createQuestions).toHaveBeenCalled();
      expect(mockRepo.updateTokenUsage).toHaveBeenCalled();
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439014',
        'IN_PROGRESS',
        'GENERATING',
        0,
      );
    });

    it('transitions to FAILED state and rethrows error on legacy AI failure', async () => {
      mockRepo.findById.mockResolvedValue({ id: '507f1f77bcf86cd799439015', status: 'GENERATING', setupData: {} });
      mockAiProvider.generateQuestions.mockRejectedValue(new Error('AI provider offline'));

      const handler = new GenerateQuestionJobHandler(
        mockAiProvider,
        mockRepo,
        mockEventPublisher,
        undefined
      );

      await expect(
        handler.handle({ interviewId: '507f1f77bcf86cd799439015', ownerId: '507f1f77bcf86cd799439012' })
      ).rejects.toThrow('AI provider offline');
      expect(mockRepo.updateStatus).toHaveBeenCalledWith('507f1f77bcf86cd799439015', 'FAILED', 'GENERATING', 0);
    });
  });

  describe('QuestionBankSelector Taxonomy Resolution & Edge Cases', () => {
    let mockQuestionRepo: any;

    beforeEach(() => {
      mockQuestionRepo = {
        findEligiblePublishedForSelection: vi.fn(),
      };
      vi.restoreAllMocks();
    });

    it('resolves string role code/name to ObjectId via Role model', async () => {
      const validId = new mongoose.Types.ObjectId().toHexString();
      vi.spyOn(Role, 'findOne').mockResolvedValue({ id: validId } as any);
      mockQuestionRepo.findEligiblePublishedForSelection.mockResolvedValue([]);

      const selector = new QuestionBankSelector(mockQuestionRepo);
      await selector.findEligibleQuestions({ roleId: 'frontend-engineer' });

      expect(Role.findOne).toHaveBeenCalledWith({
        $or: [{ name: 'frontend-engineer' }, { code: 'frontend-engineer' }],
      });
      expect(mockQuestionRepo.findEligiblePublishedForSelection).toHaveBeenCalledWith(
        expect.objectContaining({ roleId: validId })
      );
    });

    it('resolves string level code/name to ObjectId via Level model', async () => {
      const validId = new mongoose.Types.ObjectId().toHexString();
      vi.spyOn(Level, 'findOne').mockResolvedValue({ id: validId } as any);
      mockQuestionRepo.findEligiblePublishedForSelection.mockResolvedValue([]);

      const selector = new QuestionBankSelector(mockQuestionRepo);
      await selector.findEligibleQuestions({ levelId: 'senior' });

      expect(Level.findOne).toHaveBeenCalledWith({
        $or: [{ name: 'senior' }, { code: 'senior' }],
      });
      expect(mockQuestionRepo.findEligiblePublishedForSelection).toHaveBeenCalledWith(
        expect.objectContaining({ levelId: validId })
      );
    });

    it('resolves array of technology codes/names to ObjectIds via Technology model', async () => {
      const validId1 = new mongoose.Types.ObjectId().toHexString();
      const validId2 = new mongoose.Types.ObjectId().toHexString();
      vi.spyOn(Technology, 'findOne').mockImplementation(((query: any) => {
        const name = query.$or[0].name;
        if (name === 'react') return Promise.resolve({ id: validId2 });
        return Promise.resolve(null);
      }) as any);
      mockQuestionRepo.findEligiblePublishedForSelection.mockResolvedValue([]);

      const selector = new QuestionBankSelector(mockQuestionRepo);
      await selector.findEligibleQuestions({ technologyIds: [validId1, 'react'] });

      expect(mockQuestionRepo.findEligiblePublishedForSelection).toHaveBeenCalledWith(
        expect.objectContaining({ technologyIds: [validId1, validId2] })
      );
    });

    it('skips question items missing vi or en prompt in findEligibleQuestions', async () => {
      mockQuestionRepo.findEligiblePublishedForSelection.mockResolvedValue([
        {
          questionId: 'q1',
          prompt: { vi: 'Câu hỏi 1', en: 'Question 1' },
          difficulty: 'EASY',
          type: 'TECHNICAL',
        },
        {
          questionId: 'q2',
          prompt: { vi: '', en: 'Question 2' },
          difficulty: 'MEDIUM',
        },
        {
          questionId: 'q3',
          prompt: { vi: 'Câu hỏi 3' },
          difficulty: 'HARD',
        },
      ]);

      const selector = new QuestionBankSelector(mockQuestionRepo);
      const results = await selector.findEligibleQuestions({});
      expect(results).toHaveLength(1);
      expect(results[0].questionId).toBe('q1');
    });
  });

  describe('Question Bank Zod Validators SuperRefine & Edge Coverage', () => {
    describe('semanticDuplicateSchema', () => {
      it('validates target EXISTING with required questionId and versionNumber', () => {
        const validId = new mongoose.Types.ObjectId().toHexString();
        const result = semanticDuplicateSchema.safeParse({
          body: {
            target: 'EXISTING',
            questionId: validId,
            versionNumber: 1,
          },
          query: {},
          params: {},
        });
        expect(result.success).toBe(true);
      });

      it('rejects target EXISTING when questionId or versionNumber is missing', () => {
        const result = semanticDuplicateSchema.safeParse({
          body: {
            target: 'EXISTING',
          },
          query: {},
          params: {},
        });
        expect(result.success).toBe(false);
      });

      it('rejects target EXISTING when draft payload is provided', () => {
        const validId = new mongoose.Types.ObjectId().toHexString();
        const result = semanticDuplicateSchema.safeParse({
          body: {
            target: 'EXISTING',
            questionId: validId,
            versionNumber: 1,
            draft: { prompt: { vi: 'test', en: 'test' } },
          },
          query: {},
          params: {},
        });
        expect(result.success).toBe(false);
      });

      it('validates target DRAFT with bilingual prompt', () => {
        const result = semanticDuplicateSchema.safeParse({
          body: {
            target: 'DRAFT',
            draft: { prompt: { vi: 'Nội dung tiếng Việt', en: 'English prompt' } },
          },
          query: {},
          params: {},
        });
        expect(result.success).toBe(true);
      });

      it('rejects target DRAFT when prompt has neither vi nor en', () => {
        const result = semanticDuplicateSchema.safeParse({
          body: {
            target: 'DRAFT',
            draft: { prompt: {} },
          },
          query: {},
          params: {},
        });
        expect(result.success).toBe(false);
      });

      it('rejects target DRAFT when questionId or versionNumber is provided', () => {
        const validId = new mongoose.Types.ObjectId().toHexString();
        const result = semanticDuplicateSchema.safeParse({
          body: {
            target: 'DRAFT',
            questionId: validId,
            draft: { prompt: { vi: 'Test', en: 'Test' } },
          },
          query: {},
          params: {},
        });
        expect(result.success).toBe(false);
      });
    });

    describe('translationApplySchema', () => {
      const validId = new mongoose.Types.ObjectId().toHexString();

      it('rejects when sourceLocale and targetLocale are identical', () => {
        const result = translationApplySchema.safeParse({
          body: {
            sourceLocale: 'vi',
            targetLocale: 'vi',
            fields: ['prompt'],
            translations: {
              prompt: 'Bản dịch mới',
            },
          },
          query: {},
          params: { questionId: validId, versionNumber: 1 },
        });
        expect(result.success).toBe(false);
      });

      it('accepts when sourceLocale and targetLocale are distinct', () => {
        const result = translationApplySchema.safeParse({
          body: {
            sourceLocale: 'vi',
            targetLocale: 'en',
            fields: ['prompt'],
            translations: {
              prompt: 'Translated english prompt',
            },
          },
          query: {},
          params: { questionId: validId, versionNumber: 1 },
        });
        expect(result.success).toBe(true);
      });
    });

    describe('questionVersionAuthoringSchema classification validation', () => {
      const validRoleId = new mongoose.Types.ObjectId().toHexString();
      const validTechId = new mongoose.Types.ObjectId().toHexString();

      it('rejects when additionalRoleIds contains primaryRoleId', () => {
        const result = questionVersionAuthoringSchema.safeParse({
          classification: {
            primaryRoleId: validRoleId,
            additionalRoleIds: [validRoleId],
          },
        });
        expect(result.success).toBe(false);
      });

      it('rejects when classificationComplete is true, technologyAgnostic is false, but technologies is empty', () => {
        const result = questionVersionAuthoringSchema.safeParse({
          classification: {
            classificationComplete: true,
            technologyAgnostic: false,
            technologies: [],
          },
        });
        expect(result.success).toBe(false);
      });

      it('accepts when classificationComplete is true and technologyAgnostic is true with empty technologies', () => {
        const result = questionVersionAuthoringSchema.safeParse({
          classification: {
            classificationComplete: true,
            technologyAgnostic: true,
            technologies: [],
          },
        });
        expect(result.success).toBe(true);
      });

      it('accepts when classificationComplete is true and technologies has valid entries', () => {
        const result = questionVersionAuthoringSchema.safeParse({
          classification: {
            classificationComplete: true,
            technologyAgnostic: false,
            technologies: [{ technologyId: validTechId, relevance: 90 }],
          },
        });
        expect(result.success).toBe(true);
      });
    });

    describe('embeddingBackfillSchema', () => {
      it('applies defaults for batchSize (20) and forceRecompute (false)', () => {
        const result = embeddingBackfillSchema.safeParse({
          body: {},
          query: {},
          params: {},
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.body.batchSize).toBe(20);
          expect(result.data.body.forceRecompute).toBe(false);
        }
      });
    });
  });

  describe('Safe DTO Edge Handling', () => {
    it('handles session with null questions gracefully', () => {
      const safe = toCandidateSafeInterviewSession({
        id: 'sess_safe_1',
        userId: 'user_1',
        status: 'PENDING',
        setupData: { jobPosition: 'role_1' },
        overallScore: null,
        dimensions: null,
        learningPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      expect(safe.id).toBe('sess_safe_1');
      expect(safe.questions).toBeUndefined();
      expect((safe as any).metadata).toBeUndefined();
    });

    it('returns null/undefined when session passed is falsy', () => {
      expect(toCandidateSafeInterviewSession(null)).toBeNull();
      expect(toCandidateSafeInterviewSession(undefined)).toBeUndefined();
    });

    it('handles questions without candidateAnswer or feedback', () => {
      const safeQ = toCandidateSafeInterviewQuestion({
        id: 'q_safe_1',
        sessionId: 'sess_safe_1',
        order: 1,
        difficulty: 'EASY',
        content: { vi: 'Câu hỏi', en: 'Question' },
        candidateAnswer: null,
        feedback: null,
        score: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      expect(safeQ.id).toBe('q_safe_1');
      expect(safeQ.candidateAnswer).toBeNull();
      expect(safeQ.feedback).toBeNull();
      expect(safeQ.score).toBeNull();
      expect((safeQ as any).sourceType).toBeUndefined();
    });
  });

  describe('MongoInterviewRepository Standalone Fallback & State Branch Coverage', () => {
    it('handles standalone fallback when startSession indicates unsupported transactions', async () => {
      const ownerId = new mongoose.Types.ObjectId().toHexString();
      const repo = new MongoInterviewRepository(ownerId);
      const mockSessionId = new mongoose.Types.ObjectId().toHexString();

      const startSessionSpy = vi.spyOn(mongoose, 'startSession').mockRejectedValue(
        new Error('Transactions are not supported by this deployment')
      );

      let questionFindCall = 0;
      vi.spyOn(InterviewQuestionModel, 'find').mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve(questionFindCall++ === 0 ? [] : Array.from({ length: 5 }, (_, index) => ({
            _id: new mongoose.Types.ObjectId(),
            sessionId: mockSessionId,
            order: index + 1,
            difficulty: 'EASY',
            content: { en: `Q${index + 1}`, vi: `Q${index + 1}` },
          }))),
        }),
      } as any);
      vi.spyOn(InterviewSessionModel, 'exists').mockResolvedValue(true as any);

      vi.spyOn(InterviewSessionModel, 'findOneAndUpdate').mockResolvedValue({
        _id: mockSessionId,
        status: 'IN_PROGRESS',
        setupData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      vi.spyOn(InterviewSessionModel, 'findOne').mockReturnValue({
        lean: () => Promise.resolve({
          _id: mockSessionId,
          userId: ownerId,
          status: 'IN_PROGRESS',
          setupData: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      } as any);

      vi.spyOn(InterviewQuestionModel, 'insertMany').mockResolvedValue([] as any);

      const bundle = {
        questions: [
          { order: 1, difficulty: 'EASY', content: { vi: 'Q1', en: 'Q1' }, sourceType: 'AI_GENERATED' as const },
          { order: 2, difficulty: 'MEDIUM', content: { vi: 'Q2', en: 'Q2' }, sourceType: 'AI_GENERATED' as const },
          { order: 3, difficulty: 'MEDIUM', content: { vi: 'Q3', en: 'Q3' }, sourceType: 'AI_GENERATED' as const },
          { order: 4, difficulty: 'HARD', content: { vi: 'Q4', en: 'Q4' }, sourceType: 'AI_GENERATED' as const },
          { order: 5, difficulty: 'HARD', content: { vi: 'Q5', en: 'Q5' }, sourceType: 'AI_GENERATED' as const },
        ],
        audit: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      };

      const result = await repo.commitInterviewQuestionsBundle(mockSessionId, bundle);
      expect(result.status).toBe('IN_PROGRESS');

      startSessionSpy.mockRestore();
    });

    it('standalone fallback returns existing session if status is already IN_PROGRESS or COMPLETED', async () => {
      const ownerId = new mongoose.Types.ObjectId().toHexString();
      const repo = new MongoInterviewRepository(ownerId);
      const mockSessionId = new mongoose.Types.ObjectId().toHexString();

      vi.spyOn(mongoose, 'startSession').mockRejectedValue(
        new Error('standalone server does not support transactions')
      );

      let questionFindCall = 0;
      vi.spyOn(InterviewQuestionModel, 'find').mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve(questionFindCall++ === 0 ? [] : Array.from({ length: 5 }, (_, index) => ({
            _id: new mongoose.Types.ObjectId(),
            sessionId: mockSessionId,
            order: index + 1,
            difficulty: 'EASY',
            content: { en: `Q${index + 1}`, vi: `Q${index + 1}` },
          }))),
        }),
      } as any);

      vi.spyOn(InterviewSessionModel, 'findOneAndUpdate').mockResolvedValue(null);
      vi.spyOn(InterviewSessionModel, 'exists').mockResolvedValue(true as any);
      vi.spyOn(InterviewSessionModel, 'findOne').mockReturnValue({
        lean: () => Promise.resolve({
          _id: mockSessionId,
          userId: ownerId,
          status: 'IN_PROGRESS',
          setupData: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      } as any);
      vi.spyOn(InterviewSessionModel, 'findById').mockReturnValue({
        _id: mockSessionId,
        status: 'IN_PROGRESS',
        setupData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        lean: () => Promise.resolve({
          _id: mockSessionId,
          status: 'IN_PROGRESS',
          setupData: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      } as any);

      const bundle = {
        questions: [
          { order: 1, difficulty: 'EASY', content: { vi: 'Q1', en: 'Q1' }, sourceType: 'AI_GENERATED' as const },
          { order: 2, difficulty: 'MEDIUM', content: { vi: 'Q2', en: 'Q2' }, sourceType: 'AI_GENERATED' as const },
          { order: 3, difficulty: 'MEDIUM', content: { vi: 'Q3', en: 'Q3' }, sourceType: 'AI_GENERATED' as const },
          { order: 4, difficulty: 'HARD', content: { vi: 'Q4', en: 'Q4' }, sourceType: 'AI_GENERATED' as const },
          { order: 5, difficulty: 'HARD', content: { vi: 'Q5', en: 'Q5' }, sourceType: 'AI_GENERATED' as const },
        ],
        audit: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      };

      const result = await repo.commitInterviewQuestionsBundle(mockSessionId, bundle);
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('standalone fallback throws CONFLICT if session cannot be claimed and is not in progress', async () => {
      const ownerId = new mongoose.Types.ObjectId().toHexString();
      const repo = new MongoInterviewRepository(ownerId);
      const mockSessionId = new mongoose.Types.ObjectId().toHexString();

      vi.spyOn(mongoose, 'startSession').mockRejectedValue(
        new Error('standalone mode')
      );

      vi.spyOn(InterviewQuestionModel, 'find').mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve([]),
        }),
      } as any);

      vi.spyOn(InterviewSessionModel, 'findOneAndUpdate').mockResolvedValue(null);
      vi.spyOn(InterviewSessionModel, 'exists').mockResolvedValue(true as any);
      vi.spyOn(InterviewSessionModel, 'findOne').mockReturnValue({
        lean: () => Promise.resolve({ _id: mockSessionId, userId: ownerId, status: 'FAILED' }),
      } as any);
      vi.spyOn(InterviewSessionModel, 'findById').mockReturnValue({
        _id: mockSessionId,
        status: 'FAILED',
        lean: () => Promise.resolve({
          _id: mockSessionId,
          status: 'FAILED',
        }),
      } as any);

      const bundle = {
        questions: [
          { order: 1, difficulty: 'EASY', content: { vi: 'Q1', en: 'Q1' }, sourceType: 'AI_GENERATED' as const },
          { order: 2, difficulty: 'MEDIUM', content: { vi: 'Q2', en: 'Q2' }, sourceType: 'AI_GENERATED' as const },
          { order: 3, difficulty: 'MEDIUM', content: { vi: 'Q3', en: 'Q3' }, sourceType: 'AI_GENERATED' as const },
          { order: 4, difficulty: 'HARD', content: { vi: 'Q4', en: 'Q4' }, sourceType: 'AI_GENERATED' as const },
          { order: 5, difficulty: 'HARD', content: { vi: 'Q5', en: 'Q5' }, sourceType: 'AI_GENERATED' as const },
        ],
        audit: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      };

      await expect(repo.commitInterviewQuestionsBundle(mockSessionId, bundle)).rejects.toThrow(
        expect.objectContaining({ code: 'INTERVIEW_QUESTION_GENERATION_CONFLICT' })
      );
    });

    it('standalone fallback cleans up and marks session FAILED if insertMany fails', async () => {
      const ownerId = new mongoose.Types.ObjectId().toHexString();
      const repo = new MongoInterviewRepository(ownerId);
      const mockSessionId = new mongoose.Types.ObjectId().toHexString();

      vi.spyOn(mongoose, 'startSession').mockRejectedValue(
        new Error('standalone mode')
      );

      vi.spyOn(InterviewQuestionModel, 'find').mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve([]),
        }),
      } as any);
      vi.spyOn(InterviewSessionModel, 'exists').mockResolvedValue(true as any);

      vi.spyOn(InterviewSessionModel, 'findOneAndUpdate').mockResolvedValue({
        _id: mockSessionId,
        status: 'IN_PROGRESS',
      } as any);

      vi.spyOn(InterviewQuestionModel, 'insertMany').mockRejectedValue(new Error('Write concern error'));
      const updateSpy = vi.spyOn(InterviewSessionModel, 'updateOne').mockResolvedValue({} as any);

      const bundle = {
        audit: {
          promptTokenCount: 3,
          candidatesTokenCount: 5,
          totalTokenCount: 8,
        },
        questions: [
          { order: 1, difficulty: 'EASY', content: { vi: 'Q1', en: 'Q1' }, sourceType: 'AI_GENERATED' as const },
          { order: 2, difficulty: 'MEDIUM', content: { vi: 'Q2', en: 'Q2' }, sourceType: 'AI_GENERATED' as const },
          { order: 3, difficulty: 'MEDIUM', content: { vi: 'Q3', en: 'Q3' }, sourceType: 'AI_GENERATED' as const },
          { order: 4, difficulty: 'HARD', content: { vi: 'Q4', en: 'Q4' }, sourceType: 'AI_GENERATED' as const },
          { order: 5, difficulty: 'HARD', content: { vi: 'Q5', en: 'Q5' }, sourceType: 'AI_GENERATED' as const },
        ],
      };

      await expect(repo.commitInterviewQuestionsBundle(mockSessionId, bundle)).rejects.toThrow(
        'Write concern error'
      );
      expect(updateSpy).toHaveBeenCalledWith(
        { _id: mockSessionId, userId: ownerId },
        { $set: { status: 'FAILED', metadata: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 } } },
      );
    });
  });

  describe('RequestIdMiddleware Unit Suite', () => {
    it('preserves valid incoming x-request-id', async () => {
      const { requestIdMiddleware } = await import('../src/middlewares/request-id.middleware');
      const req: any = {
        header: vi.fn().mockReturnValue('req_test_12345678'),
      };
      const res: any = {
        locals: {},
        setHeader: vi.fn(),
      };
      const next = vi.fn();

      requestIdMiddleware(req, res, next);
      expect(res.locals.requestId).toBe('req_test_12345678');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'req_test_12345678');
      expect(next).toHaveBeenCalled();
    });

    it('generates fresh uuid when x-request-id is missing or unsafe', async () => {
      const { requestIdMiddleware } = await import('../src/middlewares/request-id.middleware');
      const req: any = {
        header: vi.fn().mockReturnValue('bad id with spaces!'),
      };
      const res: any = {
        locals: {},
        setHeader: vi.fn(),
      };
      const next = vi.fn();

      requestIdMiddleware(req, res, next);
      expect(res.locals.requestId).toMatch(/^req_[0-9a-f-]+$/);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('QuestionBankFeatureMiddlewares Unit Suite', () => {
    it('enforces feature flags across all 4 feature middlewares', async () => {
      const envModule = await import('../src/config/env');
      const {
        requireQuestionBankAdminApi,
        requireQuestionBankAiTranslationEnabled,
        requireQuestionBankSemanticDuplicatesEnabled,
        requireQuestionBankEmbeddingBackfillEnabled,
      } = await import('../src/middlewares/question-bank-feature.middleware');

      const mockEnv = {
        QUESTION_BANK_ADMIN_API_ENABLED: false,
        QUESTION_BANK_AI_TRANSLATION_ENABLED: false,
        QUESTION_BANK_SEMANTIC_DUPLICATES_ENABLED: false,
        QUESTION_BANK_EMBEDDING_BACKFILL_ENABLED: false,
      };
      const getEnvSpy = vi.spyOn(envModule, 'getEnv').mockReturnValue(mockEnv as any);

      const req: any = {};
      const res: any = {};

      try {
        // 1. Admin API
        mockEnv.QUESTION_BANK_ADMIN_API_ENABLED = false;
        let errResult: any;
        requireQuestionBankAdminApi(req, res, (err) => { errResult = err; });
        expect(errResult).toBeInstanceOf(AppError);
        expect(errResult.code).toBe('QUESTION_BANK_FEATURE_DISABLED');

        mockEnv.QUESTION_BANK_ADMIN_API_ENABLED = true;
        let ok = false;
        requireQuestionBankAdminApi(req, res, () => { ok = true; });
        expect(ok).toBe(true);

        // 2. AI Translation
        mockEnv.QUESTION_BANK_AI_TRANSLATION_ENABLED = false;
        requireQuestionBankAiTranslationEnabled(req, res, (err) => { errResult = err; });
        expect(errResult.code).toBe('QUESTION_TRANSLATION_DISABLED');

        mockEnv.QUESTION_BANK_AI_TRANSLATION_ENABLED = true;
        ok = false;
        requireQuestionBankAiTranslationEnabled(req, res, () => { ok = true; });
        expect(ok).toBe(true);

        // 3. Semantic Duplicates
        mockEnv.QUESTION_BANK_SEMANTIC_DUPLICATES_ENABLED = false;
        requireQuestionBankSemanticDuplicatesEnabled(req, res, (err) => { errResult = err; });
        expect(errResult.code).toBe('QUESTION_SEMANTIC_SEARCH_DISABLED');

        mockEnv.QUESTION_BANK_SEMANTIC_DUPLICATES_ENABLED = true;
        ok = false;
        requireQuestionBankSemanticDuplicatesEnabled(req, res, () => { ok = true; });
        expect(ok).toBe(true);

        // 4. Embedding Backfill
        mockEnv.QUESTION_BANK_EMBEDDING_BACKFILL_ENABLED = false;
        requireQuestionBankEmbeddingBackfillEnabled(req, res, (err) => { errResult = err; });
        expect(errResult.code).toBe('QUESTION_EMBEDDING_BACKFILL_DISABLED');

        mockEnv.QUESTION_BANK_EMBEDDING_BACKFILL_ENABLED = true;
        ok = false;
        requireQuestionBankEmbeddingBackfillEnabled(req, res, () => { ok = true; });
        expect(ok).toBe(true);
      } finally {
        getEnvSpy.mockRestore();
      }
    });
  });

  describe('EmailService & NodemailerEmailProvider Unit Suite', () => {
    it('covers EmailService setProvider, getProvider, and sendPasswordResetOtp', async () => {
      const { EmailService } = await import('../src/services/email.service');
      const mockProvider = {
        sendEmail: vi.fn().mockResolvedValue(undefined),
      };

      const svc = new EmailService(mockProvider);
      expect(svc.getProvider()).toBe(mockProvider);

      const anotherProvider = { sendEmail: vi.fn() };
      svc.setProvider(anotherProvider);
      expect(svc.getProvider()).toBe(anotherProvider);

      await svc.sendPasswordResetOtp('user@example.com', '123456');
      expect(anotherProvider.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Mã xác thực'),
          text: expect.stringContaining('123456'),
        })
      );
    });

    it('covers NodemailerEmailProvider getTransporter with auth config', async () => {
      const envModule = await import('../src/config/env');
      const getEnvSpy = vi.spyOn(envModule, 'getEnv').mockReturnValue({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: 'testuser',
        SMTP_PASS: 'testpass',
        SMTP_FROM: 'noreply@example.com',
      } as any);

      const { NodemailerEmailProvider } = await import('../src/services/email.service');
      const provider = new NodemailerEmailProvider({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: 'testuser',
        SMTP_PASS: 'testpass',
        SMTP_FROM: 'noreply@example.com',
      } as any);

      // Access private getTransporter via bracket notation
      const transporter = (provider as any).getTransporter();
      expect(transporter).toBeDefined();

      // Second call uses cached transporter
      const cached = (provider as any).getTransporter();
      expect(cached).toBe(transporter);

      getEnvSpy.mockRestore();
    });
  });

  describe('AiInterviewQuestionSource Branch Coverage', () => {
    it('handles missing order, missing or invalid difficulty, and missing policyVersion', async () => {
      const { AiInterviewQuestionSource } = await import('../src/domain/interview/question-source/AiInterviewQuestionSource');
      const mockAi = {
        generateQuestions: vi.fn().mockResolvedValue({
          data: [
            {
              // missing order
              difficulty: 'UNKNOWN_DIFFICULTY',
              content: { vi: 'Câu hỏi', en: 'Question' },
            },
          ],
          audit: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 },
        }),
      };

      const source = new AiInterviewQuestionSource(mockAi as any);
      const res = await source.generateQuestions({
        sessionId: 'sess_ai_edge',
        setupData: {},
        // policyVersion is undefined
      });

      expect(res.questions).toHaveLength(1);
      expect(res.questions[0].order).toBe(1); // defaulted to idx + 1
      expect(res.questions[0].difficulty).toBe('MEDIUM'); // defaulted
      expect(res.questions[0].selectionPolicyVersion).toBe('v1'); // defaulted
    });
  });

  describe('Hashing Canonicalization Branch Coverage', () => {
    it('covers all primitive types, dates, bigints, arrays, and circular checks in canonicalJsonStringify', async () => {
      const { canonicalJsonStringify } = await import('../src/domain/question-bank/hashing');

      // NaN and Infinity become null
      expect(canonicalJsonStringify(NaN)).toBe('null');
      expect(canonicalJsonStringify(Infinity)).toBe('null');

      // BigInt and Date
      expect(canonicalJsonStringify(BigInt(42))).toBe('"42"');
      const now = new Date();
      expect(canonicalJsonStringify(now)).toBe(`"${now.toISOString()}"`);

      // Array with undefined, function, symbol
      expect(canonicalJsonStringify([undefined, () => {}, Symbol('test')])).toBe('[null,null,null]');

      // Object with undefined, function, symbol values
      expect(canonicalJsonStringify({ a: undefined, b: () => {}, c: Symbol('k'), d: 'valid' })).toBe('{"d":"valid"}');

      // Top-level function or symbol
      expect(canonicalJsonStringify(() => {})).toBe('null');
      expect(canonicalJsonStringify(Symbol('top'))).toBe('null');

      // Circular reference throws TypeError
      const circular: any = {};
      circular.self = circular;
      expect(() => canonicalJsonStringify(circular)).toThrow(TypeError);
    });
  });

  describe('CSV Parser and Escape Branch Coverage', () => {
    it('covers standalone CR, CRLF, LF, formula injection, and escape edges in CSV', async () => {
      const { parseCsvString, sanitizeFormulaInjection, escapeCsvCell } = await import('../src/domain/question-bank/csv');

      // Standalone \r vs \r\n vs \n
      const csvWithCr = 'col1,col2\rval1,val2\r\nrow2a,row2b\nrow3a,row3b';
      const parsed = parseCsvString(csvWithCr);
      expect(parsed.length).toBeGreaterThanOrEqual(3);

      // Formula triggers
      expect(sanitizeFormulaInjection('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeFormulaInjection('+12345')).toBe("'+12345");
      expect(sanitizeFormulaInjection('-12345')).toBe("'-12345");
      expect(sanitizeFormulaInjection('@cmd')).toBe("'@cmd");
      expect(sanitizeFormulaInjection('\tcmd')).toBe("'\tcmd");
      expect(sanitizeFormulaInjection('\rcmd')).toBe("'\rcmd");
      expect(sanitizeFormulaInjection('')).toBe('');
      expect(sanitizeFormulaInjection(123 as any)).toBe(123);

      // escapeCsvCell
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
      expect(escapeCsvCell('regular')).toBe('regular');
      expect(escapeCsvCell('has,comma')).toBe('"has,comma"');
      expect(escapeCsvCell('has"quotes')).toBe('"has""quotes"');
      expect(escapeCsvCell('=formula')).toBe('"\'=formula"');
    });
  });

  describe('Similarity & Vector Validation Branch Coverage', () => {
    it('covers vector validation errors and cosineSimilarity clamp/zero branches', async () => {
      const { validateVector, cosineSimilarity } = await import('../src/domain/question-bank/similarity');

      // validateVector errors
      expect(() => validateVector('not_array')).toThrow();
      expect(() => validateVector([], 3)).toThrow(); // wrong dimension
      expect(() => validateVector([])).toThrow(); // empty array
      expect(() => validateVector([1, NaN, 3])).toThrow(); // non-finite

      // cosineSimilarity
      expect(() => cosineSimilarity([1, 2], [1])).toThrow(); // dimension mismatch
      expect(cosineSimilarity([0, 0], [1, 1])).toBe(0); // zero norm
      expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
      expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    });
  });

  describe('User Model toJSON and toObject Transforms', () => {
    it('strips sensitive fields and formats id on toJSON and toObject', async () => {
      const { default: User } = await import('../src/models/user.model');
      const user = new User({
        email: 'user@example.com',
        fullName: 'Test User',
        passwordHash: 'hash123',
        role: 'CANDIDATE',
        status: 'ACTIVE',
        authVersion: 1,
        credentialVersion: 1,
      });

      const json = user.toJSON();
      expect(json.id).toBeDefined();
      expect((json as any)._id).toBeUndefined();
      expect((json as any).passwordHash).toBeUndefined();
      expect((json as any).authVersion).toBeUndefined();
      expect((json as any).credentialVersion).toBeUndefined();

      const obj = user.toObject();
      expect(obj.id).toBeDefined();
      expect((obj as any)._id).toBeUndefined();
      expect((obj as any).passwordHash).toBeUndefined();
    });
  });

  describe('Question Bank Policies Completeness Validation', () => {
    it('covers all domain completeness validation branches in validateQuestionCompleteness', async () => {
      const { validateQuestionCompleteness } = await import('../src/domain/question-bank/policies');

      const issues = validateQuestionCompleteness({
        prompt: { vi: 'Câu hỏi', en: 'Question' },
        explanation: { vi: null, en: null },
        primaryRoleId: '507f1f77bcf86cd799439011',
        additionalRoleIds: [],
        levelIds: ['507f1f77bcf86cd799439012'],
        technologies: [],
        technologyAgnostic: false, // non-agnostic but 0 technologies
        topic: 'Test',
        tags: ['test-tag'],
        difficulty: 'MEDIUM',
        questionType: 'TECHNICAL',
        referenceAnswer: { vi: 'Trả lời vi', en: '' }, // prompt en exists, but referenceAnswer en is missing
        rubric: [
          {
            title: { vi: '', en: '' }, // missing localized text
            weight: 50,
            levels: [
              { score: 1, description: { vi: '', en: '' } }, // missing localized description
              { score: 2, description: { vi: 'Đầy đủ', en: 'Full' } },
            ],
          },
          {
            title: { vi: 'Tiêu chí 2', en: 'Criterion 2' },
            weight: 50,
            levels: [
              { score: 1, description: { vi: 'Yếu', en: 'Weak' } },
              { score: 2, description: { vi: 'Tốt', en: 'Good' } },
            ],
          },
        ],
      } as any);

      expect(issues.some((i) => i.field === 'classification.technologies')).toBe(true);
      expect(issues.some((i) => i.field === 'answer.referenceAnswer.en')).toBe(true);
      expect(issues.some((i) => i.field?.includes('title'))).toBe(true);
      expect(issues.some((i) => i.field?.includes('description'))).toBe(true);
    });
  });

  describe('InterviewQuestionSourcePolicy Distribution Switch', () => {
    it('covers all branches of getHybridTargetDistribution (counts 1, 3, 4, default)', async () => {
      const { getHybridTargetDistribution } = await import(
        '../src/domain/interview/question-source/InterviewQuestionSourcePolicy'
      );

      const d1 = getHybridTargetDistribution(1);
      expect(d1.bank.MEDIUM).toBe(1);
      expect(d1.bank.EASY).toBe(0);

      const d3 = getHybridTargetDistribution(3);
      expect(d3.bank.EASY).toBe(1);
      expect(d3.bank.MEDIUM).toBe(1);
      expect(d3.bank.HARD).toBe(1);

      const d4 = getHybridTargetDistribution(4);
      expect(d4.bank.EASY).toBe(1);
      expect(d4.bank.MEDIUM).toBe(2);
      expect(d4.bank.HARD).toBe(1);

      const dDefault = getHybridTargetDistribution(0);
      expect(dDefault.bank.EASY).toBe(0);
      expect(dDefault.bank.MEDIUM).toBe(1);
    });
  });

  describe('HybridInterviewQuestionSource Edge Branches', () => {
    it('falls back to AI when selector throws error and fallback is allowed', async () => {
      const { HybridInterviewQuestionSource } = await import(
        '../src/domain/interview/question-source/HybridInterviewQuestionSource'
      );

      const throwingSelector = {
        findEligibleQuestions: vi.fn().mockRejectedValue(new Error('DB Connection Timeout')),
      };

      const mockAiProvider = {
        generateQuestions: vi.fn().mockResolvedValue({
          data: [
            { order: 1, difficulty: 'Easy', content: { vi: 'Q1 vi', en: 'Q1 en' } },
            { order: 2, difficulty: 'Medium', content: { vi: 'Q2 vi', en: 'Q2 en' } },
            { order: 3, difficulty: 'Medium', content: { vi: 'Q3 vi', en: 'Q3 en' } },
            { order: 4, difficulty: 'Hard', content: { vi: 'Q4 vi', en: 'Q4 en' } },
            { order: 5, difficulty: 'Hard', content: { vi: 'Q5 vi', en: 'Q5 en' } },
          ],
          audit: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
        }),
      };

      const hybridSource = new HybridInterviewQuestionSource(
        throwingSelector as any,
        mockAiProvider as any,
        2,
        true // allow fallback
      );

      const result = await hybridSource.generateQuestions({
        sessionId: 'sess_hybrid_fallback_on_error',
        setupData: { jobPosition: 'role_1' },
      });

      expect(result.questions).toHaveLength(5);
      expect(result.questions.every((q) => q.sourceType === 'AI_GENERATED')).toBe(true);
      expect(result.diagnostics?.fallbackReasonCode).toBe('INTERVIEW_QUESTION_SOURCE_UNAVAILABLE');
    });

    it('throws BUNDLE_INVALID when eligible AI questions are fewer than needed', async () => {
      const { HybridInterviewQuestionSource } = await import(
        '../src/domain/interview/question-source/HybridInterviewQuestionSource'
      );

      const emptySelector = {
        findEligibleQuestions: vi.fn().mockResolvedValue([]),
      };

      // AI only generates 2 questions instead of 5
      const shortAiProvider = {
        generateQuestions: vi.fn().mockResolvedValue({
          data: [
            { order: 1, difficulty: 'Easy', content: { vi: 'Q1', en: 'Q1' } },
            { order: 2, difficulty: 'Medium', content: { vi: 'Q2', en: 'Q2' } },
          ],
          audit: {},
        }),
      };

      const hybridSource = new HybridInterviewQuestionSource(
        emptySelector as any,
        shortAiProvider as any,
        2,
        true
      );

      await expect(
        hybridSource.generateQuestions({
          sessionId: 'sess_hybrid_short_ai',
          setupData: {},
        })
      ).rejects.toThrow(expect.objectContaining({ code: 'INTERVIEW_QUESTION_BUNDLE_INVALID' }));
    });
  });

  describe('InterviewQuestionBundleValidator Error Branches', () => {
    it('throws BUNDLE_INVALID when difficulty is invalid, content is un-fingerprintable, or sourceType is unknown', async () => {
      const { InterviewQuestionBundleValidator } = await import(
        '../src/domain/interview/question-source/InterviewQuestionBundleValidator'
      );

      // 1. Invalid difficulty
      expect(() =>
        InterviewQuestionBundleValidator.validate([
          { order: 1, difficulty: 'EXTREME' as any, content: { vi: 'A', en: 'B' }, sourceType: 'AI_GENERATED' },
          { order: 2, difficulty: 'MEDIUM', content: { vi: 'C', en: 'D' }, sourceType: 'AI_GENERATED' },
          { order: 3, difficulty: 'MEDIUM', content: { vi: 'E', en: 'F' }, sourceType: 'AI_GENERATED' },
          { order: 4, difficulty: 'HARD', content: { vi: 'G', en: 'H' }, sourceType: 'AI_GENERATED' },
          { order: 5, difficulty: 'HARD', content: { vi: 'I', en: 'J' }, sourceType: 'AI_GENERATED' },
        ])
      ).toThrow(expect.objectContaining({ code: 'INTERVIEW_QUESTION_BUNDLE_INVALID' }));

      // 2. Un-fingerprintable content (pure whitespace)
      expect(() =>
        InterviewQuestionBundleValidator.validate([
          { order: 1, difficulty: 'EASY', content: { vi: '   ', en: '   ' }, sourceType: 'AI_GENERATED' },
          { order: 2, difficulty: 'MEDIUM', content: { vi: 'C', en: 'D' }, sourceType: 'AI_GENERATED' },
          { order: 3, difficulty: 'MEDIUM', content: { vi: 'E', en: 'F' }, sourceType: 'AI_GENERATED' },
          { order: 4, difficulty: 'HARD', content: { vi: 'G', en: 'H' }, sourceType: 'AI_GENERATED' },
          { order: 5, difficulty: 'HARD', content: { vi: 'I', en: 'J' }, sourceType: 'AI_GENERATED' },
        ])
      ).toThrow(expect.objectContaining({ code: 'INTERVIEW_QUESTION_BUNDLE_INVALID' }));

      // 3. Unknown sourceType
      expect(() =>
        InterviewQuestionBundleValidator.validate([
          { order: 1, difficulty: 'EASY', content: { vi: 'A', en: 'B' }, sourceType: 'COMMUNITY' as any },
          { order: 2, difficulty: 'MEDIUM', content: { vi: 'C', en: 'D' }, sourceType: 'AI_GENERATED' },
          { order: 3, difficulty: 'MEDIUM', content: { vi: 'E', en: 'F' }, sourceType: 'AI_GENERATED' },
          { order: 4, difficulty: 'HARD', content: { vi: 'G', en: 'H' }, sourceType: 'AI_GENERATED' },
          { order: 5, difficulty: 'HARD', content: { vi: 'I', en: 'J' }, sourceType: 'AI_GENERATED' },
        ])
      ).toThrow(expect.objectContaining({ code: 'INTERVIEW_QUESTION_BUNDLE_INVALID' }));
    });
  });

  describe('Question Repository Mapper Records Branch Coverage', () => {
    it('covers all optional and fallback branches in toQuestionRecord and toQuestionVersionRecord', async () => {
      const { toQuestionRecord, toQuestionVersionRecord } = await import(
        '../src/repositories/question.repository'
      );

      const qId = new mongoose.Types.ObjectId();
      const vId = new mongoose.Types.ObjectId();
      const uId = new mongoose.Types.ObjectId();

      // toQuestionRecord with null currentPublishedVersionId and null draftVersionId
      const qRecord = toQuestionRecord({
        _id: qId,
        code: 'QB-2026-000001',
        lifecycleStatus: 'ACTIVE',
        ownerId: uId,
        currentPublishedVersionId: null,
        draftVersionId: null,
        latestVersionNumber: 1,
        revision: 1,
        createdBy: uId,
        updatedBy: uId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      expect(qRecord.currentPublishedVersionId).toBeNull();
      expect(qRecord.draftVersionId).toBeNull();

      // toQuestionVersionRecord with null primaryRoleId, sourceVersionId, normalizedPromptFingerprint, empty contributorIds
      const vRecord = toQuestionVersionRecord({
        _id: vId,
        questionId: qId,
        versionNumber: 1,
        status: 'DRAFT',
        revision: 1,
        prompt: { vi: 'vi', en: 'en' },
        explanation: { vi: null, en: null },
        followUps: [],
        questionType: 'TECHNICAL',
        difficulty: 'EASY',
        primaryRoleId: null,
        additionalRoleIds: [],
        levelIds: [],
        technologies: [],
        technologyAgnostic: true,
        classificationComplete: false,
        topic: null,
        tags: [],
        referenceAnswer: { vi: null, en: null },
        learningObjective: { vi: null, en: null },
        estimatedTimeSeconds: null,
        rubric: [],
        changeSummary: null,
        origin: 'MANUAL',
        sourceVersionId: null,
        sourceReference: null,
        contentHash: 'hash',
        normalizedPromptFingerprint: null,
        createdBy: uId,
        updatedBy: uId,
        contributorIds: [], // empty -> defaults to [createdBy, updatedBy]
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      expect(vRecord.primaryRoleId).toBeNull();
      expect(vRecord.sourceVersionId).toBeNull();
      expect(vRecord.normalizedPromptFingerprint).toBeNull();
      expect(vRecord.contributorIds).toHaveLength(2);
    });
  });

  describe('InterviewQuestionGenerationOrchestrator Failure State Transition Coverage', () => {
    it('handles transition failure gracefully when updateStatus throws inside catch block', async () => {
      const { InterviewQuestionGenerationOrchestrator } = await import(
        '../src/domain/interview/question-source/InterviewQuestionGenerationOrchestrator'
      );

      const sessionId = new mongoose.Types.ObjectId().toHexString();
      const mockRepo = {
        findById: vi.fn().mockResolvedValue({
          id: sessionId,
          status: 'GENERATING',
          setupData: {},
        }),
        updateStatus: vi.fn().mockRejectedValue(new Error('DB unreachable')),
        commitInterviewQuestionsBundle: vi.fn(),
      };

      const failingAi = {
        generateQuestions: vi.fn().mockRejectedValue(new Error('AI generation crash')),
      };

      vi.spyOn(InterviewQuestionModel, 'countDocuments').mockResolvedValue(0 as any);

      const orchestrator = new InterviewQuestionGenerationOrchestrator(
        mockRepo as any,
        failingAi as any,
        {} as any
      );

      // Should throw the primary error ('AI generation crash') without crashing on updateStatus failure
      await expect(orchestrator.generateAndCommit(sessionId, {})).rejects.toThrow('AI generation crash');
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(sessionId, 'FAILED');
    });
  });

  describe('MongoInterviewRepository Additional Methods & Transaction Branches', () => {
    it('covers findById returning null, create, createQuestions, updateStatus, update, and question updates', async () => {
      const ownerId = new mongoose.Types.ObjectId().toHexString();
      const repo = new MongoInterviewRepository(ownerId);
      const validId = new mongoose.Types.ObjectId().toHexString();

      // findById returning null
      vi.spyOn(InterviewSessionModel, 'findOne').mockReturnValue({
        lean: () => Promise.resolve(null),
      } as any);
      vi.spyOn(InterviewSessionModel, 'exists').mockImplementation(async (filter: any) =>
        Boolean(filter?.userId),
      );
      expect(await repo.findById(validId)).toBeNull();

      // create
      vi.spyOn(InterviewSessionModel, 'create').mockResolvedValue({
        _id: validId,
        userId: ownerId,
        status: 'PENDING',
        setupData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      const created = await repo.create({ jobPosition: 'dev' }, ownerId);
      expect(created.id).toBe(validId);

      // createQuestions
      vi.spyOn(InterviewQuestionModel, 'insertMany').mockResolvedValue([
        {
          _id: validId,
          sessionId: validId,
          order: 1,
          difficulty: 'EASY',
          content: { vi: 'v', en: 'e' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);
      const questions = await repo.createQuestions(validId, [
        { order: 1, difficulty: 'EASY', content: { vi: 'v', en: 'e' } },
      ]);
      expect(questions).toHaveLength(1);

      // updateQuestionAnswer and updateQuestionFeedback
      const updateQ = vi.spyOn(InterviewQuestionModel, 'updateOne').mockResolvedValue({ matchedCount: 1 } as any);
      await repo.updateQuestionAnswer(validId, 'my answer', validId);
      expect(updateQ).toHaveBeenCalledWith(
        { _id: validId, sessionId: validId },
        { candidateAnswer: 'my answer' },
      );

      await repo.updateQuestionFeedback(validId, { vi: 'tốt', en: 'good' }, 8, validId);
      expect(updateQ).toHaveBeenCalledWith(
        { _id: validId, sessionId: validId },
        { feedback: { vi: 'tốt', en: 'good' }, score: 8 },
      );

      // updateStatus and update
      const updateS = vi.spyOn(InterviewSessionModel, 'findOneAndUpdate').mockReturnValue({
        lean: () => Promise.resolve({ version: 1 }),
      } as any);
      await repo.updateStatus(validId, 'COMPLETED');
      expect(updateS).toHaveBeenCalled();

      const updateSession = vi.spyOn(InterviewSessionModel, 'updateOne').mockResolvedValue({} as any);
      await repo.update(validId, { overallScore: 90 });
      expect(updateSession).toHaveBeenCalledWith(
        { _id: validId, userId: ownerId },
        { $set: { overallScore: 90 } },
      );

      // updateTokenUsage
      await repo.updateTokenUsage(validId, { promptTokenCount: 5, candidatesTokenCount: 10, totalTokenCount: 15 });
      expect(updateSession).toHaveBeenCalledWith({ _id: validId, userId: ownerId }, {
        $inc: {
          'metadata.promptTokens': 5,
          'metadata.candidatesTokens': 10,
          'metadata.totalTokens': 15,
        },
      });
    });
  });

  describe('SafeDto Deep Edge Cases Suite', () => {
    it('covers all ternary branches of toCandidateSafeInterviewQuestion', () => {
      const q1 = toCandidateSafeInterviewQuestion({
        id: 'id_123',
        order: 1,
        difficulty: 'EASY',
      });
      expect(q1.id).toBe('id_123');
      expect(q1.sessionId).toBe('');
      expect(q1.content.en).toBe('');
      expect(q1.content.vi).toBe('');
      expect(q1.feedback).toBeNull();
      expect(q1.candidateAnswer).toBeNull();
      expect(q1.score).toBeNull();

      const q2 = toCandidateSafeInterviewQuestion({
        _id: 'mongo_123',
        sessionId: 'sess_456',
        order: 2,
        difficulty: 'MEDIUM',
        content: { en: 'Hello' },
        feedback: {},
        candidateAnswer: 'my ans',
        score: 10,
      });
      expect(q2.id).toBe('mongo_123');
      expect(q2.sessionId).toBe('sess_456');
      expect(q2.content.en).toBe('Hello');
      expect(q2.content.vi).toBe('');
      expect(q2.feedback).toEqual({ en: '', vi: '' });
      expect(q2.candidateAnswer).toBe('my ans');
      expect(q2.score).toBe(10);
    });
  });

  describe('QuestionBankSelector Edge Slugs and Fallbacks', () => {
    it('handles unresolved role, level, tech, and item fallbacks', async () => {
      const mockRepo = {
        findEligiblePublishedForSelection: vi.fn().mockResolvedValue([
          {
            questionId: 'qb_1',
            id: 'ver_fallback',
            code: 'CODE-1',
            prompt: { vi: 'Câu 1', en: 'Q 1' },
          },
          {
            questionId: 'qb_2',
            prompt: { vi: '   ', en: 'Valid' },
          },
        ]),
      };

      const selector = new QuestionBankSelector(mockRepo as any);

      vi.spyOn(Role, 'findOne').mockResolvedValue(null as any);
      vi.spyOn(Level, 'findOne').mockResolvedValue(null as any);
      vi.spyOn(Technology, 'findOne').mockResolvedValue(null as any);

      const res = await selector.findEligibleQuestions({
        roleId: 'non-object-id-role',
        levelId: 'non-object-id-level',
        technologyIds: ['non-object-id-tech', new mongoose.Types.ObjectId().toHexString()],
      });

      expect(res).toHaveLength(1);
      expect(res[0].versionId).toBe('ver_fallback');
      expect(res[0].difficulty).toBe('MEDIUM');
    });
  });

  describe('AiInterviewQuestionSource Defaults and Fallback Suite', () => {
    it('covers all default branches and fallbacks in AiInterviewQuestionSource', async () => {
      const { AiInterviewQuestionSource } = await import(
        '../src/domain/interview/question-source/AiInterviewQuestionSource'
      );
      const mockAiProvider = {
        generateQuestions: vi.fn().mockResolvedValue({
          data: [
            {
              difficulty: 'VERY_HARD',
            },
            {
              order: 2,
              difficulty: 'EASY',
              content: { vi: 'Hỏi 2', en: 'Ask 2' },
            },
          ],
          audit: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 },
        }),
      };

      const source = new AiInterviewQuestionSource(mockAiProvider as any);
      const res = await source.generateQuestions({
        sessionId: 'sess_1',
        setupData: { jobPosition: 'dev' },
      });

      expect(res.questions).toHaveLength(2);
      expect(res.questions[0].order).toBe(1);
      expect(res.questions[0].difficulty).toBe('MEDIUM');
      expect(res.questions[0].content.vi).toBe('');
      expect(res.questions[0].content.en).toBe('');
      expect(res.questions[0].selectionPolicyVersion).toBe('v1');
    });
  });

  describe('InterviewQuestionGenerationOrchestrator Mode and Status Branches', () => {
    it('transitions PENDING session to GENERATING', async () => {
      const mockRepo = {
        findById: vi.fn().mockResolvedValue({
          id: 'sess_pend',
          status: 'PENDING',
          setupData: { jobPosition: 'node' },
        }),
        countExistingQuestions: vi.fn().mockResolvedValue(0),
        updateStatus: vi.fn().mockResolvedValue({} as any),
        commitInterviewQuestionsBundle: vi.fn().mockResolvedValue({ id: 'sess_pend', questions: [] }),
      };
      const mockAiProvider = {
        generateQuestions: vi.fn().mockResolvedValue({
          data: [
            { order: 1, difficulty: 'EASY', content: { vi: 'v1', en: 'e1' } },
            { order: 2, difficulty: 'MEDIUM', content: { vi: 'v2', en: 'e2' } },
            { order: 3, difficulty: 'MEDIUM', content: { vi: 'v3', en: 'e3' } },
            { order: 4, difficulty: 'HARD', content: { vi: 'v4', en: 'e4' } },
            { order: 5, difficulty: 'HARD', content: { vi: 'v5', en: 'e5' } },
          ],
          audit: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 },
        }),
      };

      const orchestrator = new InterviewQuestionGenerationOrchestrator(
        mockRepo as any,
        mockAiProvider as any,
        {} as any,
        undefined
      );

      await orchestrator.generateAndCommit('sess_pend');
      expect(mockRepo.updateStatus).toHaveBeenCalledWith('sess_pend', 'GENERATING');
    });

    it('throws GENERATION_CONFLICT when session is in terminal state', async () => {
      const mockRepo = {
        findById: vi.fn().mockResolvedValue({
          id: 'sess_done',
          status: 'COMPLETED',
        }),
        countExistingQuestions: vi.fn().mockResolvedValue(0),
      };

      const orchestrator = new InterviewQuestionGenerationOrchestrator(
        mockRepo as any,
        {} as any,
        {} as any,
        undefined
      );

      await expect(orchestrator.generateAndCommit('sess_done')).rejects.toThrow(
        expect.objectContaining({ code: 'INTERVIEW_QUESTION_GENERATION_CONFLICT' })
      );
    });

    it('covers SHADOW mode evaluation error branches', async () => {
      const mockRepo = {
        findById: vi.fn().mockResolvedValue({
          id: 'sess_shadow',
          status: 'GENERATING',
          setupData: { jobPosition: 'node' },
        }),
        countExistingQuestions: vi.fn().mockResolvedValue(0),
        updateStatus: vi.fn().mockResolvedValue({} as any),
        commitInterviewQuestionsBundle: vi.fn().mockResolvedValue({ id: 'sess_shadow', questions: [] }),
      };
      const mockAiProvider = {
        generateQuestions: vi.fn().mockResolvedValue({
          data: [
            { order: 1, difficulty: 'EASY', content: { vi: 'v1', en: 'e1' } },
            { order: 2, difficulty: 'MEDIUM', content: { vi: 'v2', en: 'e2' } },
            { order: 3, difficulty: 'MEDIUM', content: { vi: 'v3', en: 'e3' } },
            { order: 4, difficulty: 'HARD', content: { vi: 'v4', en: 'e4' } },
            { order: 5, difficulty: 'HARD', content: { vi: 'v5', en: 'e5' } },
          ],
          audit: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 },
        }),
      };
      const mockSelector = {
        findEligibleQuestions: vi.fn().mockRejectedValue(new Error('Bank timeout')),
      };

      const orchestrator = new InterviewQuestionGenerationOrchestrator(
        mockRepo as any,
        mockAiProvider as any,
        mockSelector as any,
        undefined
      );
      vi.spyOn(orchestrator as any, 'getEffectiveMode').mockReturnValue('SHADOW');

      const res = await orchestrator.generateAndCommit('sess_shadow');
      expect(res).toBeDefined();
    });
  });

  describe('MongoInterviewRepository Bundle Metadata and Populated Fields', () => {
    it('commits bundle with question bank provenance and initializes empty metadata', async () => {
      const ownerId = new mongoose.Types.ObjectId().toHexString();
      const repo = new MongoInterviewRepository(ownerId);
      const mockSessionId = new mongoose.Types.ObjectId().toHexString();
      const qbQuestionId = new mongoose.Types.ObjectId().toHexString();
      const qbVersionId = new mongoose.Types.ObjectId().toHexString();

      const mockSessionDoc: any = {
        _id: mockSessionId,
        userId: ownerId,
        status: 'GENERATING',
        metadata: null,
        save: vi.fn().mockResolvedValue(true),
        toObject: vi.fn().mockReturnValue({ _id: mockSessionId, status: 'IN_PROGRESS' }),
      };

      const mongoSessionMock: any = {
        withTransaction: vi.fn(async (cb: any) => {
          await cb();
        }),
        endSession: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(mongoose, 'startSession').mockResolvedValue(mongoSessionMock);
      vi.spyOn(InterviewSessionModel, 'exists').mockResolvedValue(true as any);
      vi.spyOn(InterviewSessionModel, 'findOne').mockReturnValue({
        session: () => Promise.resolve(mockSessionDoc),
        lean: () => Promise.resolve(mockSessionDoc),
      } as any);

      vi.spyOn(InterviewQuestionModel, 'countDocuments').mockReturnValue({
        session: () => Promise.resolve(0),
      } as any);

      const insertSpy = vi.spyOn(InterviewQuestionModel, 'insertMany').mockResolvedValue([] as any);
      vi.spyOn(InterviewQuestionModel, 'find').mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve([]),
        }),
      } as any);

      const bundle: any = {
        questions: [
          {
            order: 1,
            difficulty: 'EASY',
            content: { vi: 'Q1', en: 'Q1' },
            sourceType: 'QUESTION_BANK',
            questionBankQuestionId: qbQuestionId,
            questionBankVersionId: qbVersionId,
            questionBankVersionNumber: 2,
            questionBankCode: 'CODE-1',
            selectionPolicyVersion: 'v1',
            selectionSeedFingerprint: 'fp123',
            promptSnapshotHash: 'hash123',
            selectedAt: new Date(),
          },
          { order: 2, difficulty: 'MEDIUM', content: { vi: 'Q2', en: 'Q2' }, sourceType: 'AI_GENERATED' },
          { order: 3, difficulty: 'MEDIUM', content: { vi: 'Q3', en: 'Q3' }, sourceType: 'AI_GENERATED' },
          { order: 4, difficulty: 'HARD', content: { vi: 'Q4', en: 'Q4' }, sourceType: 'AI_GENERATED' },
          { order: 5, difficulty: 'HARD', content: { vi: 'Q5', en: 'Q5' }, sourceType: 'AI_GENERATED' },
        ],
        audit: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      };

      const res = await repo.commitInterviewQuestionsBundle(mockSessionId, bundle);
      expect(res).toBeDefined();
      expect(mockSessionDoc.metadata.promptTokens).toBe(10);
      expect(mockSessionDoc.metadata.candidatesTokens).toBe(20);
      expect(mockSessionDoc.metadata.totalTokens).toBe(30);
      expect(insertSpy).toHaveBeenCalled();
    });
  });
});


