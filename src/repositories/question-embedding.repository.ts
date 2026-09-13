import { injectable } from 'tsyringe';
import { Types } from 'mongoose';
import { IQuestionEmbedding, QuestionEmbeddingModel } from '../models/question-embedding.model';
import {
  IQuestionEmbeddingRepository,
  UpsertEmbeddingInput,
} from './interfaces/IQuestionEmbeddingRepository';

@injectable()
export class QuestionEmbeddingRepository implements IQuestionEmbeddingRepository {
  async findByVersionAndModel(
    versionId: string,
    provider: string,
    model: string,
    contentHash: string
  ): Promise<IQuestionEmbedding | null> {
    return QuestionEmbeddingModel.findOne({
      questionVersionId: new Types.ObjectId(versionId),
      provider,
      model,
      contentHash,
    }).exec();
  }

  async upsertEmbedding(input: UpsertEmbeddingInput): Promise<IQuestionEmbedding> {
    const filter = {
      questionVersionId: new Types.ObjectId(input.questionVersionId),
      provider: input.provider,
      model: input.model,
      contentHash: input.contentHash,
    };

    const update = {
      $set: {
        questionId: new Types.ObjectId(input.questionId),
        dimensions: input.dimensions,
        vector: input.vector,
        status: input.status || 'READY',
        lastErrorCode: input.lastErrorCode || null,
      },
      $inc: { attempts: 1 },
    };

    return QuestionEmbeddingModel.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }).exec() as Promise<IQuestionEmbedding>;
  }

  async findReadyEmbeddingsForVersions(
    versionIds: string[],
    provider: string,
    model: string
  ): Promise<IQuestionEmbedding[]> {
    if (versionIds.length === 0) return [];

    const objectIds = versionIds.map((id) => new Types.ObjectId(id));
    return QuestionEmbeddingModel.find({
      questionVersionId: { $in: objectIds },
      provider,
      model,
      status: 'READY',
    }).exec();
  }

  async markStaleByVersion(
    versionId: string,
    exceptContentHash: string
  ): Promise<number> {
    const result = await QuestionEmbeddingModel.updateMany(
      {
        questionVersionId: new Types.ObjectId(versionId),
        contentHash: { $ne: exceptContentHash },
        status: { $ne: 'STALE' },
      },
      {
        $set: { status: 'STALE' },
      }
    ).exec();

    return result.modifiedCount;
  }
}
