import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
vi.hoisted(() => {
  process.env.NODE_ENV='test';
  process.env.JWT_ACCESS_SECRET='sec03_access_secret_at_least_32_characters';
  process.env.JWT_REFRESH_SECRET='sec03_refresh_secret_at_least_32_characters';
  process.env.PASSWORD_RESET_SECRET='sec03_reset_secret_at_least_32_characters';
});
import app from '../src/app';
import User from '../src/models/user.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { RetentionRun } from '../src/models/retention-run.model';
import { MongoInterviewRepository } from '../src/repositories/MongoInterviewRepository';
import { InterviewService } from '../src/services/InterviewService';
import { MockAiProvider } from '../src/services/ai/providers/MockAiProvider';
import { GenerateQuestionJobHandler } from '../src/domain/jobs/handlers/GenerateQuestionJobHandler';
import { EvaluateAnswersJobHandler } from '../src/domain/jobs/handlers/EvaluateAnswersJobHandler';
import { generateAuthTokens } from '../src/utils/token';
import { runRetentionBatch } from '../src/services/data-retention.service';
import { DAY_MS } from '../src/services/retention-policy';
import { generated, docx } from './helpers/ai-fixtures';
import { getEnv } from '../src/config/env';
import { FileParserFactory } from '../src/utils/parsers/FileParserFactory';
import { createTaxonomyFixture } from './fixtures/aip55.factories';

describe('SEC-03 ownership, async boundary and disposable retention', () => {
  let repl:MongoMemoryReplSet;
  let taxonomy: Awaited<ReturnType<typeof createTaxonomyFixture>>;
  const repo = new MongoInterviewRepository();
  const mock = new MockAiProvider();
  beforeAll(async () => { repl=await MongoMemoryReplSet.create({replSet:{count:1}}); });
  beforeEach(async () => {
    vi.restoreAllMocks(); process.env.RETENTION_MUTATION_ENABLED='false'; process.env.RETENTION_APPROVAL_ID='';
    await mongoose.disconnect();
    // Never use getEnv().MONGODB_URI: every test gets a database on the newly created disposable replica set.
    await mongoose.connect(repl.getUri('aip54_'+randomUUID().replaceAll('-','')));
    await Promise.all([InterviewSessionModel.createIndexes(),InterviewQuestionModel.createIndexes(),RetentionRun.createIndexes()]);
    taxonomy = await createTaxonomyFixture();
  });
  afterAll(async () => { await mongoose.disconnect(); await repl.stop(); });
  const user = (role:'ADMIN'|'CANDIDATE'='CANDIDATE') => User.create({email:`${randomUUID()}@example.invalid`,fullName:'Fixture',
    passwordHash:'unused-in-token-tests',role,status:'ACTIVE',credentialVersion:0,authVersion:0});
  const token = (u:any) => `Bearer ${generateAuthTokens(u._id.toString(),u.role,undefined,undefined,0).accessToken}`;
  const validSetup = (overrides:Record<string, unknown> = {}) => ({
    jobPosition: taxonomy.role._id.toString(),
    level: taxonomy.level._id.toString(),
    techStacks: [taxonomy.technology._id.toString()],
    ...overrides,
  });
  const fixture = async () => {
    const owner=await user(); const ownerId=owner._id.toString(); const scoped=repo.forOwner(ownerId);
    const session=await scoped.create({jdText:'OWNER_PRIVATE_JD',jobPosition:'Developer'},ownerId);
    const qs=await scoped.createQuestions(session.id,generated());
    return {owner,ownerId,scoped,session,qs};
  };
  const approve = () => { process.env.RETENTION_MUTATION_ENABLED='true'; process.env.RETENTION_APPROVAL_ID='POLICY-DISPOSABLE-TEST'; };

  it('requires auth before upload and rejects body owner injection', async () => {
    const parse = vi.spyOn(FileParserFactory, 'getParser');
    await request(app).post('/api/v1/interviews/generate-from-jd').attach('jdFile',Buffer.from('malformed'),{filename:'private.doc',contentType:'application/msword'}).expect(401);
    expect(parse).not.toHaveBeenCalled();
    const owner=await user();
    await request(app).post('/api/v1/interviews/generate-from-jd').set('Authorization',token(owner))
      .field('userId',new mongoose.Types.ObjectId().toString()).attach('jdFile',docx(),{filename:'safe.docx',contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}).expect(400);
    expect(await InterviewSessionModel.countDocuments()).toBe(0);
  });
  it('blocks cross-user and Admin raw read/generate/submit/progress/stream at HTTP and service boundaries', async () => {
    const {session,ownerId}=await fixture(); const other=await user(),admin=await user('ADMIN');
    for(const actor of [other,admin]) {
      for(const action of ['', '/stream']) await request(app).get(`/api/v1/interviews/${session.id}${action}`).set('Authorization',token(actor)).expect(403);
      await request(app).post(`/api/v1/interviews/${session.id}/generate`).set('Authorization',token(actor)).expect(403);
      for(const action of ['submit','progress']) await request(app).post(`/api/v1/interviews/${session.id}/${action}`)
        .set('Authorization',token(actor)).send({answers:[{questionId:new mongoose.Types.ObjectId().toString(),candidateAnswer:'CROSS_USER_CANARY'}]}).expect(403);
    }
    const service=new InterviewService(repo,mock);
    await expect(service.getInterviewSession(session.id,other.id)).rejects.toMatchObject({code:'AUTH_FORBIDDEN'});
    await expect(repo.findById(session.id)).rejects.toMatchObject({code:'AUTH_FORBIDDEN'});
    expect((await service.getInterviewSession(session.id,ownerId)).setupData.jdText).toBe('OWNER_PRIVATE_JD');
  });
  it('blocks cross-session question IDs before writing any answer', async () => {
    const a=await fixture(),b=await fixture(); await a.scoped.updateStatus(a.session.id,'IN_PROGRESS');
    const service=new InterviewService(repo,mock);
    await expect(service.submitAnswers(a.session.id,[{questionId:a.qs[0].id,candidateAnswer:'SHOULD_NOT_WRITE'},
      {questionId:b.qs[0].id,candidateAnswer:'CROSS_USER_CANARY'}],a.ownerId)).rejects.toMatchObject({code:'AI_INPUT_INVALID'});
    expect((await a.scoped.findById(a.session.id))!.questions![0].candidateAnswer).toBeNull();
    expect((await b.scoped.findById(b.session.id))!.questions![0].candidateAnswer).toBeNull();
    await expect(a.scoped.updateQuestionAnswer(b.qs[0].id,'bad',a.session.id)).rejects.toMatchObject({code:'AUTH_FORBIDDEN'});
  });
  it('keeps raw content out of Admin metadata DTOs', async () => {
    await fixture(); const admin=await user('ADMIN');
    for(const endpoint of ['/api/v1/admin/users','/api/v1/admin/metrics?from=2026-01-01&to=2027-01-01']) {
      const result=await request(app).get(endpoint).set('Authorization',token(admin)).expect(200);
      expect(JSON.stringify(result.body)).not.toMatch(/OWNER_PRIVATE_JD|jdText|candidateAnswer|providerPayload|passwordHash/);
    }
  });
  it('stores only minimized extracted text and releases original buffer on success/failure', async () => {
    const owner=await user(); const service=new InterviewService(repo,mock);
    const buffer=docx('Hiring Senior Backend Developer. Responsibilities: Build APIs and microservices. Requirements: 3+ years experience with Node.js and TypeScript. Benefits: Competitive salary. Email: private.person@example.invalid');
    const session=await service.createInterviewSessionFromJD(validSetup(),buffer,'application/vnd.openxmlformats-officedocument.wordprocessingml.document',owner.id);
    expect(buffer.every(byte=>byte===0)).toBe(true);
    expect(session.setupData.jdText).not.toContain('private.person@example.invalid');
    const invalid=Buffer.from('%PDF-malformed');
    await expect(service.createInterviewSessionFromJD({},invalid,'application/pdf',owner.id)).rejects.toMatchObject({code:'FILE_PARSE_FAILED'});
    expect(invalid.every(byte=>byte===0)).toBe(true);
  });
  it('sync flow validates mock output, stores derived results and terminal timestamps', async () => {
    const owner=await user();const service=new InterviewService(repo,mock);
    const session=await service.createInterviewSession(validSetup(),owner.id);
    const ready=await service.generateQuestions(session.id,owner.id); expect(ready.questions).toHaveLength(5);
    const result=await service.submitAnswers(session.id,ready.questions!.map(q=>({questionId:q.id,candidateAnswer:'Technical evidence'})),owner.id);
    expect(result.status).toBe('COMPLETED'); expect(result.overallScore).toBe(8); expect(result.dimensions).toHaveLength(4);
    expect(result.contentPurgeAt!.getTime()-result.terminalAt!.getTime()).toBe(30*DAY_MS);
    expect(result.recordPurgeAt!.getTime()-result.terminalAt!.getTime()).toBe(365*DAY_MS);
    await repo.forOwner(owner.id).updateStatus(session.id,'FAILED');
    expect((await service.getInterviewSession(session.id,owner.id)).terminalAt).toEqual(result.terminalAt);
  });
  it('queue stores IDs only and worker reads owner-scoped data through shared validation', async () => {
    const owner=await user();const enqueue=vi.fn().mockResolvedValue(undefined);
    const service=new InterviewService(repo,mock,{enqueue} as never);
    const session=await service.createInterviewSession(validSetup({jdText:'PRIVATE_JOB_CONTENT'}),owner.id);
    await service.generateQuestions(session.id,owner.id);
    expect(enqueue.mock.calls[0]).toEqual(['GENERATE_QUESTIONS',{interviewId:session.id,ownerId:owner.id}]);
    await new GenerateQuestionJobHandler(mock,repo).handle(enqueue.mock.calls[0][1]);
    const ready=await service.getInterviewSession(session.id,owner.id);
    await service.submitAnswers(session.id,ready.questions!.map(q=>({questionId:q.id,candidateAnswer:'PRIVATE_ANSWER_CONTENT'})),owner.id);
    expect(enqueue.mock.calls[1]).toEqual(['EVALUATE_ANSWERS',{interviewId:session.id,ownerId:owner.id}]);
    await new EvaluateAnswersJobHandler(mock,repo).handle(enqueue.mock.calls[1][1]);
    expect((await service.getInterviewSession(session.id,owner.id)).status).toBe('COMPLETED');
    expect(JSON.stringify(enqueue.mock.calls)).not.toContain('PRIVATE_');
  });
  it('does not persist malformed provider output from sync or background paths', async () => {
    const owner=await user();const provider={generateQuestions:vi.fn().mockResolvedValue({data:[{order:1,secret:'SENTINEL'}],audit:{}})};
    const service=new InterviewService(repo,provider as never);
    const s=await service.createInterviewSession(validSetup(),owner.id);
    await expect(service.generateQuestions(s.id,owner.id)).rejects.toMatchObject({code:'AI_OUTPUT_INVALID'});
    expect(await InterviewQuestionModel.countDocuments({sessionId:s.id})).toBe(0);
    const other=await service.createInterviewSession(validSetup(),owner.id); await repo.forOwner(owner.id).updateStatus(other.id,'GENERATING');
    await expect(new GenerateQuestionJobHandler(provider as never,repo).handle({interviewId:other.id,ownerId:owner.id})).rejects.toMatchObject({code:'AI_OUTPUT_INVALID'});
    expect(await InterviewQuestionModel.countDocuments({sessionId:other.id})).toBe(0);
    const outsider=await user();
    await expect(new GenerateQuestionJobHandler(provider as never,repo).handle({interviewId:other.id,ownerId:outsider.id})).rejects.toMatchObject({code:'AUTH_FORBIDDEN'});
  });
  it('fails closed without approval and defaults to a bounded dry run', async () => {
    const f=await fixture(); await f.scoped.updateStatus(f.session.id,'COMPLETED');
    const now=new Date(Date.now()+31*DAY_MS);
    const result=await runRetentionBatch({now,limit:1});
    expect(result).toMatchObject({dryRun:true,contentEligible:1,contentPurged:0});
    expect((await f.scoped.findById(f.session.id))!.setupData.jdText).toBe('OWNER_PRIVATE_JD');
    await expect(runRetentionBatch({dryRun:false,now})).rejects.toMatchObject({code:'RETENTION_DISABLED'});
    process.env.RETENTION_MUTATION_ENABLED='true'; expect(()=>getEnv()).toThrow('policy reference');
  });
  it('rejects foreign evaluation question IDs in both sync and job paths before feedback persistence', async () => {
    const f=await fixture(),foreign=await fixture();
    const provider={evaluateAnswers:vi.fn(async()=>({data:{
      evaluations:f.qs.map((q,i)=>({questionId:i===0?foreign.qs[0].id:q.id,score:8,feedback:{en:'Feedback',vi:'Nhận xét'}})),
      overallScore:8,dimensions:['Technical Depth','Problem Solving','System Design & Best Practices','Communication','Practical Experience'].map(name=>({name,score:8,reasoning:'Reason'})),learningPath:[],
    },audit:{promptTokenCount:1,candidatesTokenCount:1,totalTokenCount:2}}))};
    await f.scoped.updateStatus(f.session.id,'IN_PROGRESS');
    await expect(new InterviewService(repo,provider as never).submitAnswers(f.session.id,f.qs.map(q=>({questionId:q.id,candidateAnswer:'Technical answer'})),f.ownerId)).rejects.toMatchObject({code:'AI_OUTPUT_INVALID'});
    await f.scoped.updateStatus(f.session.id,'EVALUATING');
    await expect(new EvaluateAnswersJobHandler(provider as never,repo).handle({interviewId:f.session.id,ownerId:f.ownerId})).rejects.toMatchObject({code:'AI_OUTPUT_INVALID'});
    expect((await f.scoped.findById(f.session.id))!.questions!.every(q=>q.score===null)).toBe(true);
    expect((await foreign.scoped.findById(foreign.session.id))!.questions!.every(q=>q.score===null)).toBe(true);
  });
  it('purges fields idempotently, preserves summaries/answers and never touches non-due sessions', async () => {
    const due=await fixture(),pending=await fixture(); await due.scoped.updateStatus(due.session.id,'COMPLETED');
    await InterviewSessionModel.collection.updateOne({_id:new mongoose.Types.ObjectId(due.session.id)},{$set:{providerPayload:'PRIVATE_PROVIDER'}});
    const original=await pending.scoped.findById(pending.session.id); approve();
    const now=new Date(Date.now()+31*DAY_MS);
    expect((await runRetentionBatch({dryRun:false,now})).contentPurged).toBe(1);
    const stored=await InterviewSessionModel.collection.findOne({_id:new mongoose.Types.ObjectId(due.session.id)});
    expect(stored!.setupData.jdText).toBeUndefined(); expect(stored!.providerPayload).toBeUndefined();
    expect(await InterviewQuestionModel.countDocuments({sessionId:due.session.id})).toBe(5);
    expect((await runRetentionBatch({dryRun:false,now})).contentPurged).toBe(0);
    expect(await pending.scoped.findById(pending.session.id)).toEqual(original);
    expect(JSON.stringify(await RetentionRun.find().lean())).not.toMatch(/OWNER_PRIVATE|PRIVATE_PROVIDER|jdText/);
  });
  it('record purge is exact, bounded and atomic with aggregate audit', async () => {
    const first=await fixture(),second=await fixture(),pending=await fixture();
    for(const f of [first,second]) await f.scoped.updateStatus(f.session.id,'COMPLETED');
    approve(); const now=new Date(Date.now()+366*DAY_MS);
    const before=await InterviewQuestionModel.countDocuments();
    const fail=vi.spyOn(RetentionRun,'create').mockRejectedValueOnce(new Error('SENTINEL_AUDIT_FAILURE'));
    await expect(runRetentionBatch({dryRun:false,now,limit:1})).rejects.toMatchObject({code:'RETENTION_BATCH_FAILED'});fail.mockRestore();
    expect(await InterviewQuestionModel.countDocuments()).toBe(before);
    expect(await InterviewSessionModel.countDocuments()).toBe(3);
    expect((await runRetentionBatch({dryRun:false,now,limit:1})).recordsPurged).toBe(1);
    expect(await InterviewQuestionModel.countDocuments()).toBe(10);
    expect((await runRetentionBatch({dryRun:false,now})).recordsPurged).toBe(1);
    expect((await runRetentionBatch({dryRun:false,now})).recordsPurged).toBe(0);
    expect((await pending.scoped.findById(pending.session.id))!.questions).toHaveLength(5);
  });
});
