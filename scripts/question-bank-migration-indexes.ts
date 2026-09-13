import mongoose from 'mongoose';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { QuestionSourcingEventModel } from '../src/models/question-sourcing-event.model';

export interface IndexMigrationReport {
  mode: 'VERIFY_ONLY' | 'APPLY';
  appliedCount: number;
  verifiedCount: number;
  indexes: Array<{
    collection: string;
    indexName: string;
    expectedKey: Record<string, any>;
    status: 'PRESENT' | 'MISSING' | 'CREATED';
    options?: Record<string, any>;
  }>;
}

export const TARGET_INDEX_SPECS = [
  {
    collectionName: 'interviewquestions',
    indexName: 'interview_questions_session_order_unique',
    key: { sessionId: 1, order: 1 },
    options: { unique: true, name: 'interview_questions_session_order_unique' },
  },
  {
    collectionName: 'questionsourcingevents',
    indexName: 'qse_created_event_type_idx',
    key: { createdAt: -1, eventType: 1 },
    options: { name: 'qse_created_event_type_idx' },
  },
  {
    collectionName: 'questionsourcingevents',
    indexName: 'qse_created_mode_idx',
    key: { createdAt: -1, effectiveMode: 1 },
    options: { name: 'qse_created_mode_idx' },
  },
  {
    collectionName: 'questionsourcingevents',
    indexName: 'qse_ttl_retention_idx',
    key: { createdAt: 1 },
    options: {
      name: 'qse_ttl_retention_idx',
      expireAfterSeconds: 7776000, // 90 days retention
    },
  },
];

export async function manageIndexes(options: {
  apply?: boolean;
  silent?: boolean;
}): Promise<IndexMigrationReport> {
  const isApply = options.apply === true;
  const silent = options.silent ?? false;

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established.');
  }

  const report: IndexMigrationReport = {
    mode: isApply ? 'APPLY' : 'VERIFY_ONLY',
    appliedCount: 0,
    verifiedCount: 0,
    indexes: [],
  };

  for (const spec of TARGET_INDEX_SPECS) {
    const coll = db.collection(spec.collectionName);
    let existingIndexes: any[] = [];
    try {
      existingIndexes = await coll.indexes();
    } catch {
      existingIndexes = [];
    }

    const found = existingIndexes.find(
      (idx) => idx.name === spec.indexName || JSON.stringify(idx.key) === JSON.stringify(spec.key)
    );

    if (found) {
      report.verifiedCount++;
      report.indexes.push({
        collection: spec.collectionName,
        indexName: spec.indexName,
        expectedKey: spec.key,
        status: 'PRESENT',
        options: found,
      });
    } else {
      if (isApply) {
        await coll.createIndex(spec.key, spec.options as any);
        report.appliedCount++;
        report.indexes.push({
          collection: spec.collectionName,
          indexName: spec.indexName,
          expectedKey: spec.key,
          status: 'CREATED',
          options: spec.options,
        });
      } else {
        report.indexes.push({
          collection: spec.collectionName,
          indexName: spec.indexName,
          expectedKey: spec.key,
          status: 'MISSING',
          options: spec.options,
        });
      }
    }
  }

  if (!silent) {
    console.log(`=== QUESTION BANK INDEX MIGRATION REPORT (${report.mode}) ===`);
    console.log(JSON.stringify(report, null, 2));
  }

  return report;
}

if (process.argv[1] && process.argv[1].includes('question-bank-migration-indexes')) {
  (async () => {
    try {
      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        console.error('Error: MONGODB_URI environment variable is required.');
        process.exit(1);
      }
      const apply = process.argv.includes('--apply');
      await mongoose.connect(mongoUri);
      await manageIndexes({ apply });
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('Index migration execution failed:', err);
      process.exit(1);
    }
  })();
}
