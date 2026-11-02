import { Schema, model, Document, Types } from 'mongoose';

export interface IPingMetric extends Document {
  _id: Types.ObjectId;
  timestamp: Date;
  monitorId: Types.ObjectId;
  statusCode: number;
  latency: number;
  isUp: boolean;
  error?: string | null;
}

export interface CreatePingMetricDto {
  timestamp: Date;
  monitorId: string | Types.ObjectId;
  statusCode: number;
  latency: number;
  isUp: boolean;
  error?: string | null;
}

const pingMetricSchema = new Schema<IPingMetric>(
  {
    timestamp: {
      type: Date,
      required: true,
    },
    monitorId: {
      type: Schema.Types.ObjectId,
      ref: 'Monitor',
      required: true,
    },
    statusCode: {
      type: Number,
      required: true,
    },
    latency: {
      type: Number,
      required: true,
    },
    isUp: {
      type: Boolean,
      required: true,
    },
    error: {
      type: String,
      default: null,
    },
  },
  {
    timeseries: {
      timeField: 'timestamp',
      metaField: 'monitorId',
      granularity: 'seconds',
    },
    expireAfterSeconds: 604800, // 7 days retention
    versionKey: false,
  }
);

// Compound index to optimize time-series queries and dashboard latency charts
pingMetricSchema.index({ monitorId: 1, timestamp: -1 });

export const PingMetric = model<IPingMetric>('PingMetric', pingMetricSchema, 'ping_metrics');

