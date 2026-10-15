import { Agenda, Job } from 'agenda';
import mongoose from 'mongoose';
import { IJobScheduler } from '../../domain/jobs/IJobScheduler';
import { IJobHandler } from '../../domain/jobs/IJobHandler';
import { inject, singleton } from 'tsyringe';
import { AppEnv } from '../../config/env';
import { logger, logContext } from '../logging/logger';
import { schedulerJobData } from '../../services/ai/job-security';

export interface EnqueueJobOptions {
  when?: string | Date;
  [key: string]: unknown;
}

@singleton()
export class AgendaJobScheduler implements IJobScheduler {
  private agenda!: Agenda;
  private handlers = new Map<string, IJobHandler>();
  private isStarted = false;
  private startPromise: Promise<void> | null = null;

  constructor(@inject('AppEnv') private readonly env: AppEnv) {}

  public registerHandler(handler: IJobHandler): void {
    this.handlers.set(handler.name, handler);
    if (this.isStarted && this.agenda) {
      this.defineJob(handler);
    }
  }

  private defineJob(handler: IJobHandler): void {
    this.agenda.define(handler.name, async (job: Job) => {
      return logContext.run({ requestId: job.attrs.data?.requestId }, async () => {
        logger.info('job.started', {
          jobName: handler.name,
          attempt: (job.attrs.failCount ?? 0) + 1,
        });
        try {
          await handler.handle(job.attrs.data);
          logger.info('job.completed', { jobName: handler.name });
        } catch (err: any) {
          logger.error('job.failed', {
            jobName: handler.name,
          });
          // Agenda persists failReason: never let it store a provider message or stack.
          throw new Error('JOB_EXECUTION_FAILED');
        }
      });
    });
  }

  public async start(): Promise<void> {
    if (this.isStarted) return;
    if (this.startPromise) return this.startPromise;

    this.startPromise = (async () => {
      // Wait for mongoose with a 15-second safety timeout and error rejection
      if (mongoose.connection.readyState !== 1) {
        logger.warn('scheduler.waiting');
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Timed out waiting for MongoDB connection in AgendaJobScheduler'));
          }, 15000);

          const onOpen = () => {
            cleanup();
            resolve();
          };

          const onError = (err: unknown) => {
            cleanup();
            reject(err);
          };

          const cleanup = () => {
            clearTimeout(timeout);
            mongoose.connection.removeListener('open', onOpen);
            mongoose.connection.removeListener('error', onError);
          };

          mongoose.connection.once('open', onOpen);
          mongoose.connection.once('error', onError);
        });
      }

      this.agenda = new Agenda({
        db: {
          address: this.env.MONGODB_URI,
          collection: 'agendaJobs',
        },
        disableAutoIndex: this.env.NODE_ENV === 'production',
      });

      // Register all handlers
      for (const handler of this.handlers.values()) {
        this.defineJob(handler);
      }

      await this.agenda.start();
      this.isStarted = true;
      logger.info('scheduler.started');
    })().finally(() => {
      this.startPromise = null;
    });

    return this.startPromise;
  }

  public async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.agenda.stop();
    this.isStarted = false;
    logger.info('scheduler.stopped');
  }

  public async enqueue<T>(jobName: string, data: T, options?: EnqueueJobOptions): Promise<void> {
    if (!this.handlers.has(jobName)) {
      throw new Error(`Job handler for ${jobName} not registered`);
    }

    if (!this.agenda) {
      await this.start();
    }

    const safeData = schedulerJobData({ ...data, requestId: logContext.getStore()?.requestId });
    const job = this.agenda.create(jobName, safeData);
    if (typeof (job as any)?.schedule === 'function') {
      if (options?.when) {
        job.schedule(options.when);
      } else {
        job.schedule('now');
      }
    }
    await job.save();
    logger.info('job.queued', { jobName });
  }
}
