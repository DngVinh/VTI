import { container } from 'tsyringe';
import { getEnv } from './env';
import { AgendaJobScheduler } from '../infrastructure/jobs/AgendaJobScheduler';

import { GenerateQuestionJobHandler } from '../domain/jobs/handlers/GenerateQuestionJobHandler';

import { InterviewEventBus } from '../infrastructure/events/InterviewEventBus';

// Repositories

import { RoleRepository } from '../repositories/role.repository';

import { LevelRepository } from '../repositories/level.repository';

import { TechnologyRepository } from '../repositories/technology.repository';

import { MongoInterviewRepository } from '../repositories/MongoInterviewRepository';

import { UserRepository } from '../repositories/user.repository';

import { AuditRepository } from '../repositories/audit.repository';

import { SystemPromptRepository } from '../repositories/system-prompt.repository';

import { AdminMetricsRepository } from '../repositories/admin-metrics.repository';

import { ApiRateLimitRepository } from '../repositories/api-rate-limit.repository';

import { InterviewQuotaRepository } from '../repositories/interview-quota.repository';
import { QuestionRepository } from '../repositories/question.repository';
import { QuestionWorkflowRepository } from '../repositories/question-workflow.repository';
import {
  QuestionCounterRepository,
  QuestionIdempotencyRepository,
  QuestionOutboxRepository,
  QuestionTaxonomyRepository,
} from '../repositories/question-support.repository';
import { QuestionEmbeddingRepository } from '../repositories/question-embedding.repository';
import { ConversationTurnRepository } from '../repositories/ConversationTurnRepository';

// Services

import { RoleService } from '../services/role.service';

import { LevelService } from '../services/level.service';

import { TechnologyService } from '../services/technology.service';

import { InterviewService } from '../services/InterviewService';

import { SystemPromptService } from '../services/system-prompt.service';

import { AdminMetricsService } from '../services/admin-metrics.service';

import { InterviewQuotaService } from '../services/interview-quota.service';
import { QuestionBankService } from '../services/question-bank.service';
import { PublicQuestionService } from '../services/public-question.service';

// AI Providers

import { MockAiProvider } from '../services/ai/providers/MockAiProvider';

import { GeminiAiProvider } from '../services/ai/providers/GeminiAiProvider';

import { AdminUserService } from '../services/admin-user.service';

import { AuditService } from '../services/audit.service';

import { EvaluateAnswersJobHandler } from '../domain/jobs/handlers/EvaluateAnswersJobHandler';
import { InterviewOperationProcessor } from '../services/InterviewOperationProcessor';
import { OutboxDispatcher } from '../infrastructure/jobs/OutboxDispatcher';
import { MockAiQuestionDraftProvider } from '../services/providers/mock-ai-question-draft.provider';
import { GeminiAiQuestionDraftProvider } from '../services/providers/gemini-question-draft.provider';
import { MockQuestionTranslationProvider } from '../services/providers/mock-question-translation.provider';
import { GeminiQuestionTranslationProvider } from '../services/providers/gemini-question-translation.provider';
import { MockQuestionEmbeddingProvider } from '../services/providers/mock-question-embedding.provider';
import { GeminiQuestionEmbeddingProvider } from '../services/providers/gemini-question-embedding.provider';
import { QuestionBankSelector } from '../domain/interview/question-source/QuestionBankSelector';
import { InterviewQuestionGenerationOrchestrator } from '../domain/interview/question-source/InterviewQuestionGenerationOrchestrator';

// Register Repositories

container.register('IRoleRepository', {
  useClass: RoleRepository
});

container.register('ILevelRepository', {
  useClass: LevelRepository
});

container.register('ITechnologyRepository', {
  useClass: TechnologyRepository
});

container.register('IInterviewRepository', {
  useFactory: () => new MongoInterviewRepository()
});

container.register('IInterviewHistoryRepository', {
  useFactory: () => new MongoInterviewRepository()
});

container.register('IInterviewAnalyticsRepository', {
  useFactory: () => new MongoInterviewRepository()
});

container.register('IApiRateLimitRepository', {
  useClass: ApiRateLimitRepository
});

container.register('IInterviewQuotaRepository', {
  useClass: InterviewQuotaRepository
});

container.register('IQuestionRepository', { useClass: QuestionRepository });
container.register('IQuestionWorkflowRepository', { useClass: QuestionWorkflowRepository });
container.register('IQuestionCounterRepository', { useClass: QuestionCounterRepository });
container.register('IQuestionIdempotencyRepository', { useClass: QuestionIdempotencyRepository });
container.register('IQuestionOutboxRepository', { useClass: QuestionOutboxRepository });
container.register('IQuestionTaxonomyRepository', { useClass: QuestionTaxonomyRepository });
container.register('IQuestionEmbeddingRepository', { useClass: QuestionEmbeddingRepository });
container.register('IConversationTurnRepository', {
  useFactory: () => new ConversationTurnRepository(),
});

// Register AI Provider based on .env

const env = getEnv();

container.register('AppEnv', { useValue: env });

if (env.NODE_ENV === 'test') {
  container.register('IAiProvider', {
    useClass: MockAiProvider
  });
} else {
  container.register('IAiProvider', {
    useClass: GeminiAiProvider
  });
}

// Background Jobs

container.register('OperationProcessorOptions', { useValue: {} });

container.register('OutboxDispatcherOptions', { useValue: {} });

container.registerSingleton(
  'IJobScheduler',
  AgendaJobScheduler
);

container.registerSingleton(
  InterviewOperationProcessor
);

container.registerSingleton(
  OutboxDispatcher
);

container.registerSingleton(
  GenerateQuestionJobHandler
);

container.registerSingleton(
  EvaluateAnswersJobHandler
);

// Event Bus

container.registerSingleton(
  'IEventPublisher',
  InterviewEventBus
);

container.register('IUserRepository', {
  useClass: UserRepository
});

container.register('IAuditRepository', {
  useClass: AuditRepository
});

container.register('ISystemPromptRepository', {
  useClass: SystemPromptRepository
});

container.register('IAdminMetricsRepository', {
  useClass: AdminMetricsRepository
});

// Register Services

container.register('IRoleService', {
  useClass: RoleService
});

container.register('ILevelService', {
  useClass: LevelService
});

container.register('ITechnologyService', {
  useClass: TechnologyService
});

container.register('IAdminUserService', {
  useClass: AdminUserService
});

container.register('IAuditService', {
  useClass: AuditService
});

container.register('ISystemPromptService', {
  useClass: SystemPromptService
});

container.register('IAdminMetricsService', {
  useClass: AdminMetricsService
});

container.register('IInterviewQuotaService', {
  useClass: InterviewQuotaService
});

container.register('IQuestionBankService', { useClass: QuestionBankService });
container.register('IPublicQuestionService', { useClass: PublicQuestionService });

const useMockQuestionBankAi =
  env.NODE_ENV === 'test' || env.QUESTION_BANK_AI_PROVIDER === 'mock';
if (useMockQuestionBankAi) {
  container.registerSingleton('IAiQuestionDraftProvider', MockAiQuestionDraftProvider);
  container.registerSingleton('IQuestionTranslationProvider', MockQuestionTranslationProvider);
  container.registerSingleton('IQuestionEmbeddingProvider', MockQuestionEmbeddingProvider);
} else {
  container.registerSingleton('IAiQuestionDraftProvider', GeminiAiQuestionDraftProvider);
  container.registerSingleton('IQuestionTranslationProvider', GeminiQuestionTranslationProvider);
  container.registerSingleton('IQuestionEmbeddingProvider', GeminiQuestionEmbeddingProvider);
}

container.register('IQuestionBankSelector', { useClass: QuestionBankSelector });
container.registerSingleton(InterviewQuestionGenerationOrchestrator);
container.register('InterviewQuestionGenerationOrchestrator', {
  useToken: InterviewQuestionGenerationOrchestrator,
});

// Code Sandbox & AST Review
import { MockSandboxProvider } from '../services/code-sandbox/MockSandboxProvider';
import { PistonSandboxProvider } from '../services/code-sandbox/PistonSandboxProvider';
import { ComplexityAnalyzer } from '../services/code-sandbox/ComplexityAnalyzer';
import { AiCodeReviewer } from '../services/code-sandbox/AiCodeReviewer';
import { CodeExecutionController } from '../controllers/CodeExecutionController';

container.registerSingleton(ComplexityAnalyzer);
container.registerSingleton(AiCodeReviewer);
container.registerSingleton(CodeExecutionController);

container.register('PistonApiUrl', {
  useValue: 'http://localhost:2000',
});

if (env.NODE_ENV === 'test') {
  container.registerSingleton('ISandboxProvider', MockSandboxProvider);
} else {
  container.registerSingleton('ISandboxProvider', PistonSandboxProvider);
}

// System Design Whiteboard Vision
import { GeminiVisionAnalyzer } from '../services/vision/GeminiVisionAnalyzer';
import { WhiteboardController } from '../controllers/WhiteboardController';
import { WhiteboardSnapshotModel } from '../models/WhiteboardSnapshot';

container.register('WhiteboardSnapshotModel', {
  useValue: WhiteboardSnapshotModel,
});

container.register('IVisionAiClient', {
  useValue: {
    analyzeMultimodal: async () => ({
      data: {
        detectedNodes: [
          { type: 'LOAD_BALANCER', label: 'Load Balancer' },
          { type: 'SERVICE', label: 'Core Service' },
          { type: 'DATABASE', label: 'Primary DB' },
        ],
        issues: [
          {
            type: 'SPOF',
            severity: 'HIGH',
            title: { vi: 'Điểm nghẽn duy nhất', en: 'Single Point of Failure' },
            description: { vi: 'Chưa có bản sao DB dự phòng', en: 'No standby replica' },
            suggestedFix: { vi: 'Thêm Read Replica', en: 'Add Read Replica' },
          },
        ],
        tradeOffEvaluation: { vi: 'Đánh giá đạt', en: 'Acceptable' },
        score: 8.5,
      },
    }),
  },
});

container.registerSingleton(GeminiVisionAnalyzer);
container.registerSingleton(WhiteboardController);

// Gemini Live Audio Stream
import { GeminiLiveRelay } from '../infrastructure/websocket/GeminiLiveRelay';
import { LiveAudioWebSocketServer } from '../infrastructure/websocket/websocketServer';
import { CloudTtsService } from '../services/live-audio/CloudTtsService';
import { AudioResampler } from '../services/live-audio/AudioResampler';

container.register('ISpeechClient', {
  useValue: {
    synthesizeSpeech: async () => [{ audioContent: Buffer.alloc(1600) }],
  },
});

container.registerSingleton(AudioResampler);
container.registerSingleton(CloudTtsService);
container.registerSingleton(GeminiLiveRelay);
container.registerSingleton(LiveAudioWebSocketServer);

export { container };
