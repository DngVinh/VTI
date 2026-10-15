import { IConversationTurnDocument } from '../models/ConversationTurn';

export interface IConversationTurnRepository {
  forOwner(userId: string): IConversationTurnRepository;
  createTurn(data: Partial<IConversationTurnDocument>): Promise<IConversationTurnDocument>;
  findByQuestion(sessionId: string, questionId: string): Promise<IConversationTurnDocument[]>;
  findBySession(sessionId: string): Promise<IConversationTurnDocument[]>;
  countTurns(sessionId: string, questionId: string): Promise<number>;
  getLatestTurn(sessionId: string, questionId: string): Promise<IConversationTurnDocument | null>;
}
