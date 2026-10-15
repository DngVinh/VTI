import mongoose from 'mongoose';
import { getEnv } from '../src/config/env';

export async function applyAiuIndexes(): Promise<void> {
  const env = getEnv();
  const conn = await mongoose.connect(env.MONGODB_URI);
  const db = conn.connection.db;
  if (!db) throw new Error('Database connection failed');

  console.log('[AIU Migration] Checking and applying indexes...');

  try {
    // 1. conversationturns indexes
    await db.collection('conversationturns').createIndex(
      { sessionId: 1, questionId: 1, turnIndex: 1 },
      { unique: true, name: 'uniq_session_question_turn' }
    );
    console.log(' - Created index: uniq_session_question_turn');
  } catch (err: any) {
    if (err.code === 11000 || err.code === 85) {
      console.warn(' [NOTE] Index already exists on conversationturns (code ' + err.code + ').');
    } else {
      throw err;
    }
  }

  try {
    await db.collection('conversationturns').createIndex(
      { sessionId: 1, createdAt: 1 },
      { name: 'idx_session_created' }
    );
    console.log(' - Created index: idx_session_created');
  } catch (err: any) {
    if (err.code === 85) {
      console.warn(' [NOTE] Index idx_session_created already exists.');
    } else {
      console.warn(' [WARNING] Failed creating idx_session_created:', err.message);
    }
  }

  try {
    // 2. whiteboardsnapshots index
    await db.collection('whiteboardsnapshots').createIndex(
      { sessionId: 1, questionId: 1 },
      { unique: true, name: 'uniq_whiteboard_session_question' }
    );
    console.log(' - Created index: uniq_whiteboard_session_question');
  } catch (err: any) {
    if (err.code === 11000 || err.code === 85) {
      console.warn(' [NOTE] Index already exists on whiteboardsnapshots.');
    } else {
      throw err;
    }
  }

  console.log('[AIU Migration] All indexes applied successfully.');
  await mongoose.disconnect();
}

if (require.main === module) {
  applyAiuIndexes().catch((err) => {
    console.error('[AIU Migration ERROR]:', err);
    process.exit(1);
  });
}
