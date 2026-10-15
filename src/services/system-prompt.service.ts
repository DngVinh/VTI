import {
  inject,
  injectable
} from 'tsyringe';

import {
  ISystemPrompt,
  SystemPromptLanguage,
  SystemPromptType
} from '../models/system-prompt.model';

import {
  CreatePromptInput,
  ISystemPromptService
} from './interfaces/ISystemPromptService';
import { logger } from '../infrastructure/logging/logger';

import {
  CreateSystemPromptInput,
  ISystemPromptRepository
} from '../repositories/interfaces/ISystemPromptRepository';

import {
  IAuditService
} from './interfaces/IAuditService';

@injectable()
export class SystemPromptService
  implements ISystemPromptService
{
  constructor(
    @inject('ISystemPromptRepository')
    private readonly repository:
      ISystemPromptRepository,

    @inject('IAuditService')
    private readonly auditService:
      IAuditService
  ) {}

  async createDraft(
    input: CreatePromptInput
  ): Promise<ISystemPrompt> {
    try {
      this.validateContent(input.content);

      const version =
        await this.repository.getNextVersion(
          input.promptKey,
          input.type,
          input.language
        );

      const repositoryInput:
        CreateSystemPromptInput = {
          promptKey: input.promptKey.trim(),
          type: input.type,
          language: input.language,
          content: input.content.trim(),
          createdBy: input.actorId
        };

      const draft =
        await this.repository.createDraft(
          repositoryInput,
          version
        );

      await this.auditService.createAuditLog({
        actor: input.actorId,
        target: draft._id.toString(),
        targetType: 'SYSTEM_PROMPT',
        action: 'CREATE_PROMPT_DRAFT',
        outcome: 'SUCCESS',
        version: draft.version
      });

      return draft;
    } catch (error) {
      throw error;
    }
  }

  async getPrompt(
    id: string
  ): Promise<ISystemPrompt> {
    const prompt =
      await this.repository.findById(id);

    if (!prompt) {
      throw new Error(
        'SYSTEM_PROMPT_NOT_FOUND'
      );
    }

    return prompt;
  }

  async listVersions(
    promptKey?: string,
    type?: SystemPromptType,
    language?: SystemPromptLanguage,
    status?: string
  ): Promise<ISystemPrompt[]> {
    return this.repository.findVersions(
      promptKey,
      type,
      language,
      status
    );
  }

  async publish(
    id: string,
    actorId: string
  ): Promise<ISystemPrompt> {
    let prompt: ISystemPrompt | null = null;

    try {
      prompt =
        await this.repository.findById(id);

      if (!prompt) {
        throw new Error(
          'SYSTEM_PROMPT_NOT_FOUND'
        );
      }

      /*
       * Publishing an already published version is idempotent.
       */
      if (prompt.status === 'PUBLISHED') {
        return prompt;
      }

      /*
       * Archived versions can never be published again.
       * A new version must be created instead.
       */
      if (prompt.status !== 'DRAFT') {
        throw new Error(
          'SYSTEM_PROMPT_CANNOT_BE_PUBLISHED'
        );
      }

      this.validateContent(prompt.content);

      await this.repository.archiveCurrentPublished(
        prompt.promptKey,
        prompt.type,
        prompt.language
      );

      const published =
        await this.repository.publish(
          prompt._id.toString()
        );

      if (!published) {
        throw new Error(
          'SYSTEM_PROMPT_PUBLISH_FAILED'
        );
      }

      await this.auditService.createAuditLog({
        actor: actorId,
        target: published._id.toString(),
        targetType: 'SYSTEM_PROMPT',
        action: 'PUBLISH_PROMPT',
        outcome: 'SUCCESS',
        version: published.version
      });

      return published;
    } catch (error) {
      if (prompt) {
        try {
          await this.auditService.createAuditLog({
            actor: actorId,
            target: prompt._id.toString(),
            targetType: 'SYSTEM_PROMPT',
            action: 'PUBLISH_PROMPT',
            outcome: 'FAILURE',
            version: prompt.version
          });
        } catch (auditError) {
          logger.error('audit.unavailable');
        }
      }

      throw error;
    }
  }

  async rollback(
    id: string,
    actorId: string
  ): Promise<ISystemPrompt> {
    let target: ISystemPrompt | null = null;

    try {
      target =
        await this.repository.findById(id);

      if (!target) {
        throw new Error(
          'SYSTEM_PROMPT_NOT_FOUND'
        );
      }

      if (target.status !== 'PUBLISHED') {
        throw new Error(
          'ROLLBACK_TARGET_NOT_PUBLISHED'
        );
      }

      const versions =
        await this.repository.findVersions(
          target.promptKey,
          target.type,
          target.language
        );

      /*
       * findVersions() returns newest first.
       * publishedAt != null means the version has
       * previously been published, even if archived.
       */
      const previous = versions.find(
        (version) =>
          version.version < target!.version &&
          version.publishedAt !== null
      );

      if (!previous) {
        throw new Error(
          'NO_PREVIOUS_PUBLISHED_VERSION'
        );
      }

      const nextVersion =
        await this.repository.getNextVersion(
          target.promptKey,
          target.type,
          target.language
        );

      /*
       * Rollback never mutates an existing version.
       * It creates a new version with the previous
       * published content.
       */
      const newVersion =
        await this.repository.createDraft(
          {
            promptKey: target.promptKey,
            type: target.type,
            language: target.language,
            content: previous.content,
            createdBy: actorId
          },
          nextVersion
        );

      await this.repository.archiveCurrentPublished(
        target.promptKey,
        target.type,
        target.language
      );

      const published =
        await this.repository.publish(
          newVersion._id.toString()
        );

      if (!published) {
        throw new Error(
          'SYSTEM_PROMPT_ROLLBACK_FAILED'
        );
      }

      await this.auditService.createAuditLog({
        actor: actorId,
        target: published._id.toString(),
        targetType: 'SYSTEM_PROMPT',
        action: 'ROLLBACK_PROMPT',
        outcome: 'SUCCESS',
        version: published.version
      });

      return published;
    } catch (error) {
      if (target) {
        try {
          await this.auditService.createAuditLog({
            actor: actorId,
            target: target._id.toString(),
            targetType: 'SYSTEM_PROMPT',
            action: 'ROLLBACK_PROMPT',
            outcome: 'FAILURE',
            version: target.version
          });
        } catch (auditError) {
          logger.error('audit.unavailable');
        }
      }

      throw error;
    }
  }

  async getPublished(
    promptKey: string,
    type: SystemPromptType,
    language: SystemPromptLanguage
  ): Promise<ISystemPrompt> {
    const prompt =
      await this.repository.findPublished(
        promptKey,
        type,
        language
      );

    if (!prompt) {
      throw new Error(
        'PUBLISHED_SYSTEM_PROMPT_NOT_FOUND'
      );
    }

    return prompt;
  }

  private validateContent(
    content: string
  ): void {
    if (!content || !content.trim()) {
      throw new Error(
        'SYSTEM_PROMPT_CONTENT_REQUIRED'
      );
    }

    if (content.trim().length > 50000) {
      throw new Error(
        'SYSTEM_PROMPT_CONTENT_TOO_LONG'
      );
    }
  }
}