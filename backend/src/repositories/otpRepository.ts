import { BaseRepository } from './baseRepository.js';
import { IOtp, OtpModel } from '../models/otpModel.js';

// Repository for otp_codes collection handling atomic upserts and expiration
export class OtpRepository extends BaseRepository<IOtp> {
  constructor() {
    super(OtpModel);
  }

  // Find active OTP record by normalized email
  async findByEmail(email: string): Promise<IOtp | null> {
    return this.findOne({ email: email.toLowerCase().trim() });
  }

  // Atomically upsert OTP code, resetting attempts and refreshing TTL timestamp
  async upsertOtp(email: string, codeHash: string): Promise<IOtp | null> {
    return this.model
      .findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        {
          $set: {
            codeHash,
            attempts: 0,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      )
      .exec();
  }

  // Increment failed entry attempt counter by 1
  async incrementAttempts(email: string): Promise<IOtp | null> {
    return this.model
      .findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        { $inc: { attempts: 1 } },
        { new: true }
      )
      .exec();
  }

  // Delete OTP record immediately upon successful verification or lockout
  async deleteByEmail(email: string): Promise<void> {
    await this.model.deleteOne({ email: email.toLowerCase().trim() }).exec();
  }
}

export const otpRepository = new OtpRepository();
