import mongoose, { Document, Schema, Types } from 'mongoose';
import type { VisionAnalysisResult } from '../services/vision/types';

export interface IWhiteboardSnapshot extends Document {
  sessionId: Types.ObjectId;
  questionId: string;
  imageBase64: string;
  mimeType: string;
  analysisResult?: VisionAnalysisResult;
  canvasData?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const whiteboardSnapshotSchema = new Schema<IWhiteboardSnapshot>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      index: true,
    },
    questionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    imageBase64: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      enum: ['image/png', 'image/jpeg', 'image/webp'],
      default: 'image/png',
    },
    analysisResult: {
      type: Schema.Types.Mixed,
      default: null,
    },
    canvasData: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

whiteboardSnapshotSchema.index({ sessionId: 1, questionId: 1 });

export const WhiteboardSnapshotModel = mongoose.model<IWhiteboardSnapshot>(
  'WhiteboardSnapshot',
  whiteboardSnapshotSchema
);
