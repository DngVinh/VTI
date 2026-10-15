import { z } from 'zod';

export const liveClientEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('START_SESSION'),
    sessionId: z.string().min(1),
    questionId: z.string().min(1),
  }),
  z.object({
    type: z.literal('AUDIO_CHUNK'),
    pcmBase64: z.string().min(1),
  }),
  z.object({
    type: z.literal('INTERRUPT'),
  }),
  z.object({
    type: z.literal('STOP_SESSION'),
  }),
]);

export type LiveClientEvent = z.infer<typeof liveClientEventSchema>;

export const liveServerEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SESSION_STARTED'),
    sampleRate: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('AUDIO_RESPONSE'),
    pcmBase64: z.string(),
  }),
  z.object({
    type: z.literal('TRANSCRIPT_UPDATE'),
    role: z.enum(['INTERVIEWER', 'CANDIDATE']),
    text: z.string(),
    isFinal: z.boolean(),
  }),
  z.object({
    type: z.literal('INTERRUPTED'),
  }),
  z.object({
    type: z.literal('ERROR'),
    code: z.string(),
    message: z.string(),
  }),
]);

export type LiveServerEvent = z.infer<typeof liveServerEventSchema>;
