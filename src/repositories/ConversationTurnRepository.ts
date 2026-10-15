import { injectable } from 'tsyringe';
import mongoose from 'mongoose';
import { IConversationTurnRepository } from './IConversationTurnRepository';
import { ConversationTurnModel, IConversationTurnDocument } from '../models/ConversationTurn';
import { InterviewSessionModel } from '../models/InterviewSession';

@injectable()
export class ConversationTurnRepository implements IConversationTurnRepository {
  constructor(private readonly ownerId?: string) {}

  forOwner(ownerId: string): IConversationTurnRepository {
    return new ConversationTurnRepository(ownerId);
  }

  private async assertSessionOwnership(sessionId: string): Promise<boolean> {
    if (!this.ownerId) return true;
    const session = await InterviewSessionModel.findOne({
      _id: sessionId,
      userId: this.ownerId,
    }).select('_id');
    return !!session;
  }

  async createTurn(data: Partial<IConversationTurnDocument>): Promise<IConversationTurnDocument> {
    if (this.ownerId && data.sessionId) {
      const isOwner = await this.assertSessionOwnership(data.sessionId.toString());
      if (!isOwner) {
        throw new Error('Unauthorized: Session does not belong to the owner');
      }
    }
    const turn = new ConversationTurnModel(data);
    return await turn.save();
  }

  async findByQuestion(sessionId: string, questionId: string): Promise<IConversationTurnDocument[]> {
    if (this.ownerId) {
      const isOwner = await this.assertSessionOwnership(sessionId);
      if (!isOwner) return [];
    }
    return await ConversationTurnModel.find({
      sessionId: new mongoose.Types.ObjectId(sessionId),
      questionId: new mongoose.Types.ObjectId(questionId),
    })
      .sort({ turnIndex: 1 })
      .exec();
  }

  async findBySession(sessionId: string): Promise<IConversationTurnDocument[]> {
    if (this.ownerId) {
      const isOwner = await this.assertSessionOwnership(sessionId);
      if (!isOwner) return [];
    }
    return await ConversationTurnModel.find({
      sessionId: new mongoose.Types.ObjectId(sessionId),
    })
      .sort({ createdAt: 1 })
      .exec();
  }

  async countTurns(sessionId: string, questionId: string): Promise<number> {
    if (this.ownerId) {
      const isOwner = await this.assertSessionOwnership(sessionId);
      if (!isOwner) return 0;
    }
    return await ConversationTurnModel.countDocuments({
      sessionId: new mongoose.Types.ObjectId(sessionId),
      questionId: new mongoose.Types.ObjectId(questionId),
    });
  }

  async getLatestTurn(sessionId: string, questionId: string): Promise<IConversationTurnDocument | null> {
    if (this.ownerId) {
      const isOwner = await this.assertSessionOwnership(sessionId);
      if (!isOwner) return null;
    }
    return await ConversationTurnModel.findOne({
      sessionId: new mongoose.Types.ObjectId(sessionId),
      questionId: new mongoose.Types.ObjectId(questionId),
    })
      .sort({ turnIndex: -1 })
      .exec();
  }
}
