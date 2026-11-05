import { Schema, model, Document, Types } from 'mongoose';
import { IMonitor } from './monitorModel.js';

export type IncidentStatus = 'ongoing' | 'resolved';

export interface IErrorDetails {
  statusCode: number;
  responseHeaders: Map<string, string>;
  responseBody: string;
  errorMessage: string;
}

export interface IAiPostMortem {
  summary: string;
  rootCause: string;
  actionItems: string[];
  generatedAt: Date;
}

export interface IIncident extends Document {
  _id: Types.ObjectId;
  monitorId: Types.ObjectId | IMonitor;
  userId: Types.ObjectId;
  status: IncidentStatus;
  startedAt: Date;
  resolvedAt: Date | null;
  errorDetails: IErrorDetails;
  aiPostMortem?: IAiPostMortem;
  createdAt: Date;
  updatedAt: Date;
}

const errorDetailsSchema = new Schema<IErrorDetails>(
  {
    statusCode: { type: Number, required: true, default: 0 },
    responseHeaders: { type: Map, of: String, default: {} },
    responseBody: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
  },
  { _id: false }
);

const aiPostMortemSchema = new Schema<IAiPostMortem>(
  {
    summary: { type: String, required: true },
    rootCause: { type: String, required: true },
    actionItems: { type: [String], default: [] },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const incidentSchema = new Schema<IIncident>(
  {
    monitorId: {
      type: Schema.Types.ObjectId,
      ref: 'Monitor',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ongoing', 'resolved'],
      default: 'ongoing',
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    errorDetails: {
      type: errorDetailsSchema,
      required: true,
    },
    aiPostMortem: {
      type: aiPostMortemSchema,
      required: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index for finding ongoing incident per monitor
incidentSchema.index({ monitorId: 1, status: 1 });

// Compound index for user query ordered by newest first
incidentSchema.index({ userId: 1, createdAt: -1 });

export const Incident = model<IIncident>('Incident', incidentSchema);

