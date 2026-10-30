import { Schema, model, Document, Types } from 'mongoose';

export interface IOtp extends Document {
  _id: Types.ObjectId;
  email: string;
  codeHash: string;
  attempts: number;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 300,
    },
  },
  {
    versionKey: false,
  }
);

export const OtpModel = model<IOtp>('OtpCode', otpSchema, 'otp_codes');
