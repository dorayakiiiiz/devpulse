import { Schema, model, Document, Types } from 'mongoose';

export type HttpMethod = 'GET' | 'POST' | 'HEAD';
export type MonitorStatus = 'up' | 'down' | 'pending' | 'paused';

export interface ISslInfo {
  issuer: string;
  validTo: Date;
  daysRemaining: number;
  lastCheckedAt: Date;
}

export interface IMonitor extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  url: string;
  method: HttpMethod;
  headers: Map<string, string>;
  interval: 30 | 60 | 300;
  isActive: boolean;
  status: MonitorStatus;
  lastCheckedAt: Date | null;
  sslInfo?: ISslInfo;
  createdAt: Date;
  updatedAt: Date;
}

const sslInfoSchema = new Schema<ISslInfo>(
  {
    issuer: { type: String, required: true },
    validTo: { type: Date, required: true },
    daysRemaining: { type: Number, required: true },
    lastCheckedAt: { type: Date, required: true },
  },
  { _id: false }
);

const monitorSchema = new Schema<IMonitor>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'HEAD'],
      default: 'GET',
      required: true,
    },
    headers: {
      type: Map,
      of: String,
      default: {},
    },
    interval: {
      type: Number,
      enum: [30, 60, 300],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    status: {
      type: String,
      enum: ['up', 'down', 'pending', 'paused'],
      default: 'pending',
      required: true,
    },
    lastCheckedAt: {
      type: Date,
      default: null,
    },
    sslInfo: {
      type: sslInfoSchema,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index supporting periodic scheduler queries
monitorSchema.index({ isActive: 1, interval: 1 });

export const Monitor = model<IMonitor>('Monitor', monitorSchema);

