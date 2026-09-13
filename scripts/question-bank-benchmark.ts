import { createHash } from 'node:crypto';
import mongoose from 'mongoose';

export const DEFAULT_QUESTION_COUNT = 100_000;
export const DEFAULT_VERSION_COUNT = 300_000;
export const DEFAULT_SEED = 62_001;

export interface BenchmarkOptions {
  questionCount: number;
  versionCount: number;
  seed: number;
  write: boolean;
  uri?: string;
  database?: string;
  confirmDisposableDatabase?: string;
  runId?: string;
  batchSize: number;
}

export interface SyntheticQuestionMetadata {
  syntheticId: string;
  code: string;
  lifecycleStatus: 'ACTIVE' | 'RETIRED';
  ownerId: string;
  currentPublishedVersionId: string | null;
  draftVersionId: string | null;
  latestVersionNumber: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyntheticVersionMetadata {
  syntheticId: string;
  questionId: string;
  versionNumber: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  prompt: { vi: string; en: string };
  primaryRoleId: string;
  levelIds: string[];
  technologies: Array<{ technologyId: string; relevance: number }>;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  type: 'TECHNICAL' | 'BEHAVIORAL' | 'SYSTEM_DESIGN' | 'CODING' | 'SCENARIO';
  origin: 'MANUAL' | 'IMPORTED' | 'AI_ASSISTED';
  normalizedPromptFingerprint: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface BenchmarkSummary {
  seed: number;
  questions: number;
  versions: number;
  lifecycle: Record<'ACTIVE' | 'RETIRED', number>;
  versionStatus: Record<'DRAFT' | 'PUBLISHED' | 'SUPERSEDED', number>;
  taxonomy: { hot: number; longTail: number };
  digest: string;
}

const makeRng = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const positiveInteger = (value: string, name: string): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const valueAfter = (args: string[], index: number, inline: string | undefined, name: string) => {
  if (inline !== undefined && inline !== '') return { value: inline, consumed: 0 };
  const next = args[index + 1];
  if (!next || next.startsWith('--')) throw new Error(`${name} requires a value`);
  return { value: next, consumed: 1 };
};

export const parseCliArgs = (args: string[]): BenchmarkOptions => {
  const options: BenchmarkOptions = {
    questionCount: DEFAULT_QUESTION_COUNT,
    versionCount: DEFAULT_VERSION_COUNT,
    seed: DEFAULT_SEED,
    write: false,
    batchSize: 1_000,
  };

  const assignments: Record<string, keyof BenchmarkOptions> = {
    questions: 'questionCount',
    versions: 'versionCount',
    seed: 'seed',
    uri: 'uri',
    db: 'database',
    'confirm-disposable-db': 'confirmDisposableDatabase',
    'run-id': 'runId',
    'batch-size': 'batchSize',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--write') {
      options.write = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.write = false;
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);

    const [rawName, inline] = arg.slice(2).split('=', 2);
    const target = assignments[rawName];
    if (!target) throw new Error(`Unknown option: --${rawName}`);
    const resolved = valueAfter(args, index, inline, `--${rawName}`);
    index += resolved.consumed;

    if (target === 'questionCount' || target === 'versionCount' || target === 'seed' || target === 'batchSize') {
      (options[target] as number) = positiveInteger(resolved.value, rawName);
    } else {
      (options[target] as string | undefined) = resolved.value;
    }
  }

  if (options.questionCount > 999_999) {
    throw new Error('questions cannot exceed 999999 because codes use six sequence digits');
  }
  if (options.versionCount < options.questionCount) {
    throw new Error('versions must be greater than or equal to questions');
  }
  return options;
};

const versionCountForQuestion = (questionIndex: number, options: Pick<BenchmarkOptions, 'questionCount' | 'versionCount'>) => {
  const base = Math.floor(options.versionCount / options.questionCount);
  const remainder = options.versionCount % options.questionCount;
  return base + (questionIndex < remainder ? 1 : 0);
};

const isoFor = (index: number) => new Date(Date.UTC(2026, 0, 1) + index * 1_000).toISOString();
const questionIdFor = (index: number) => `synthetic-question-${String(index + 1).padStart(6, '0')}`;
const versionIdFor = (questionIndex: number, versionNumber: number) => `${questionIdFor(questionIndex)}-v${versionNumber}`;

export function* generateQuestionMetadata(
  options: Pick<BenchmarkOptions, 'questionCount' | 'versionCount'>,
): Generator<SyntheticQuestionMetadata> {
  for (let index = 0; index < options.questionCount; index += 1) {
    const latestVersionNumber = versionCountForQuestion(index, options);
    const hasDraft = index % 5 === 0;
    const publishedVersionNumber = hasDraft && latestVersionNumber > 1
      ? latestVersionNumber - 1
      : hasDraft
        ? null
        : latestVersionNumber;
    yield {
      syntheticId: questionIdFor(index),
      code: `QB-2026-${String(index + 1).padStart(6, '0')}`,
      lifecycleStatus: index % 37 === 0 ? 'RETIRED' : 'ACTIVE',
      ownerId: `synthetic-admin-${String((index % 50) + 1).padStart(3, '0')}`,
      currentPublishedVersionId: publishedVersionNumber === null
        ? null
        : versionIdFor(index, publishedVersionNumber),
      draftVersionId: hasDraft ? versionIdFor(index, latestVersionNumber) : null,
      latestVersionNumber,
      revision: 1 + (index % 11),
      createdAt: isoFor(index),
      updatedAt: isoFor(index + latestVersionNumber),
    };
  }
}

const chooseTaxonomy = (rng: () => number) => {
  const hot = rng() < 0.8;
  const ordinal = hot ? Math.floor(rng() * 5) + 1 : Math.floor(rng() * 95) + 6;
  return { id: `technology-${String(ordinal).padStart(3, '0')}`, hot };
};

export function* generateVersionMetadata(options: Pick<BenchmarkOptions, 'questionCount' | 'versionCount' | 'seed'>): Generator<SyntheticVersionMetadata> {
  const rng = makeRng(options.seed);
  const difficulties = ['EASY', 'MEDIUM', 'HARD'] as const;
  const types = ['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING', 'SCENARIO'] as const;

  for (let questionIndex = 0; questionIndex < options.questionCount; questionIndex += 1) {
    const versionsForQuestion = versionCountForQuestion(questionIndex, options);
    const hasDraft = questionIndex % 5 === 0;
    for (let versionNumber = 1; versionNumber <= versionsForQuestion; versionNumber += 1) {
      const isLatest = versionNumber === versionsForQuestion;
      const isPublishedBeforeDraft = hasDraft && versionNumber === versionsForQuestion - 1;
      const status = isLatest
        ? hasDraft ? 'DRAFT' : 'PUBLISHED'
        : isPublishedBeforeDraft ? 'PUBLISHED' : 'SUPERSEDED';
      const taxonomy = chooseTaxonomy(rng);
      const questionOrdinal = questionIndex + 1;
      const prompt = {
        vi: `Câu hỏi tổng hợp ${questionOrdinal}, phiên bản ${versionNumber}.`,
        en: `Synthetic question ${questionOrdinal}, version ${versionNumber}.`,
      };
      yield {
        syntheticId: versionIdFor(questionIndex, versionNumber),
        questionId: questionIdFor(questionIndex),
        versionNumber,
        status,
        prompt,
        primaryRoleId: `role-${String((questionIndex % 12) + 1).padStart(2, '0')}`,
        levelIds: [`level-${String((questionIndex % 6) + 1).padStart(2, '0')}`],
        technologies: [{ technologyId: taxonomy.id, relevance: 50 + (questionIndex % 51) }],
        difficulty: difficulties[questionIndex % difficulties.length],
        type: types[questionIndex % types.length],
        origin: questionIndex % 29 === 0
          ? 'AI_ASSISTED'
          : questionIndex % 19 === 0
            ? 'IMPORTED'
            : 'MANUAL',
        normalizedPromptFingerprint: createHash('sha256')
          .update(`${prompt.vi}\n${prompt.en}`, 'utf8')
          .digest('hex'),
        revision: status === 'DRAFT' ? 1 + (questionIndex % 7) : 1,
        createdAt: isoFor(questionIndex + versionNumber),
        updatedAt: isoFor(questionIndex + versionNumber + 1),
      };
    }
  }
}

export const summarizeDataset = (
  options: Pick<BenchmarkOptions, 'questionCount' | 'versionCount' | 'seed'>,
): BenchmarkSummary => {
  const hash = createHash('sha256');
  const summary: BenchmarkSummary = {
    seed: options.seed,
    questions: 0,
    versions: 0,
    lifecycle: { ACTIVE: 0, RETIRED: 0 },
    versionStatus: { DRAFT: 0, PUBLISHED: 0, SUPERSEDED: 0 },
    taxonomy: { hot: 0, longTail: 0 },
    digest: '',
  };

  for (const question of generateQuestionMetadata(options)) {
    summary.questions += 1;
    summary.lifecycle[question.lifecycleStatus] += 1;
    hash.update(JSON.stringify(question));
  }
  for (const version of generateVersionMetadata(options)) {
    summary.versions += 1;
    summary.versionStatus[version.status] += 1;
    const technologyNumber = Number(version.technologies[0].technologyId.slice(-3));
    summary.taxonomy[technologyNumber <= 5 ? 'hot' : 'longTail'] += 1;
    hash.update(JSON.stringify(version));
  }
  summary.digest = hash.digest('hex');
  return summary;
};

const disposableName = /(?:^|[_-])(test|tests|bench|benchmark|perf|disposable|sandbox|local)(?:$|[_-])/i;
const productionName = /(prod|production|staging|stage|uat|live)/i;

const localMongoUri = (uri: string): boolean => {
  if (!uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) return false;
  const authority = uri.slice('mongodb://'.length).split('/', 1)[0];
  if (!authority || authority.includes('@')) return false;
  return authority.split(',').every((entry) => {
    const trimmed = entry.trim();
    if (/^\[::1\](?::\d+)?$/.test(trimmed)) return true;
    const host = trimmed.split(':', 1)[0];
    return host === 'localhost' || host === '127.0.0.1' || host.startsWith('127.');
  });
};

export const assertSafeWriteTarget = (options: BenchmarkOptions): void => {
  if (!options.write) return;
  if (!options.uri || !options.database || !options.confirmDisposableDatabase || !options.runId) {
    throw new Error('write mode requires --uri, --db, --confirm-disposable-db, and --run-id');
  }
  if (!localMongoUri(options.uri) || /(?:tls|ssl)=true/i.test(options.uri)) {
    throw new Error('write mode accepts only an explicit local non-TLS mongodb:// target');
  }
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(options.database)) {
    throw new Error('benchmark database name is invalid');
  }
  if (productionName.test(options.database) || !disposableName.test(options.database)) {
    throw new Error('database must be clearly named as local disposable test/benchmark data');
  }
  if (options.confirmDisposableDatabase !== options.database) {
    throw new Error('--confirm-disposable-db must exactly match --db');
  }
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(options.runId)) {
    throw new Error('run id must be 3-64 safe characters');
  }
};

const insertBatches = async (
  connection: mongoose.Connection,
  collectionName: string,
  documents: Iterable<Record<string, unknown>>,
  runId: string,
  batchSize: number,
) => {
  const collection = connection.db!.collection(collectionName);
  let batch: Array<Record<string, unknown>> = [];
  let inserted = 0;
  for (const document of documents) {
    batch.push({ runId, ...document });
    if (batch.length >= batchSize) {
      await collection.insertMany(batch, { ordered: true });
      inserted += batch.length;
      batch = [];
    }
  }
  if (batch.length > 0) {
    await collection.insertMany(batch, { ordered: true });
    inserted += batch.length;
  }
  return inserted;
};

export const writeDataset = async (options: BenchmarkOptions) => {
  assertSafeWriteTarget(options);
  const connection = await mongoose.createConnection(options.uri!, { dbName: options.database! }).asPromise();
  try {
    const questionCollection = connection.db!.collection('qb_benchmark_questions');
    const versionCollection = connection.db!.collection('qb_benchmark_versions');
    const runCollection = connection.db!.collection('qb_benchmark_runs');
    await Promise.all([
      questionCollection.createIndex({ runId: 1, code: 1 }, { unique: true, name: 'qb_bench_run_code_unique' }),
      questionCollection.createIndex({ runId: 1, lifecycleStatus: 1, updatedAt: -1 }, { name: 'qb_bench_list' }),
      versionCollection.createIndex({ runId: 1, questionId: 1, versionNumber: 1 }, { unique: true, name: 'qb_bench_version_unique' }),
      versionCollection.createIndex({ runId: 1, status: 1, primaryRoleId: 1, difficulty: 1 }, { name: 'qb_bench_role_filter' }),
      versionCollection.createIndex({ runId: 1, status: 1, 'technologies.technologyId': 1, difficulty: 1 }, { name: 'qb_bench_technology_filter' }),
      runCollection.createIndex({ runId: 1 }, { unique: true, name: 'qb_bench_run_unique' }),
    ]);
    await runCollection.insertOne({
      runId: options.runId!,
      state: 'IN_PROGRESS',
      seed: options.seed,
      questionCount: options.questionCount,
      versionCount: options.versionCount,
      startedAt: new Date(),
    });
    const questions = await insertBatches(
      connection,
      'qb_benchmark_questions',
      generateQuestionMetadata(options) as Iterable<Record<string, unknown>>,
      options.runId!,
      options.batchSize,
    );
    const versions = await insertBatches(
      connection,
      'qb_benchmark_versions',
      generateVersionMetadata(options) as Iterable<Record<string, unknown>>,
      options.runId!,
      options.batchSize,
    );
    await runCollection.updateOne(
      { runId: options.runId! },
      { $set: { state: 'COMPLETED', completedAt: new Date(), questions, versions } },
    );
    return { questions, versions, database: options.database!, runId: options.runId! };
  } finally {
    await connection.close();
  }
};

export const main = async (args = process.argv.slice(2)) => {
  const options = parseCliArgs(args);
  const startedAt = performance.now();
  const summary = summarizeDataset(options);
  if (!options.write) {
    console.log(JSON.stringify({ mode: 'dry-run', ...summary, elapsedMs: Math.round(performance.now() - startedAt) }, null, 2));
    return;
  }
  const written = await writeDataset(options);
  console.log(JSON.stringify({ mode: 'write', ...summary, ...written, elapsedMs: Math.round(performance.now() - startedAt) }, null, 2));
};

if (typeof require !== 'undefined' && require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown benchmark failure';
    console.error(`Question Bank benchmark refused or failed: ${message}`);
    process.exitCode = 1;
  });
}

