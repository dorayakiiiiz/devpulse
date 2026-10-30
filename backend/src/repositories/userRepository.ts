import { BaseRepository } from './baseRepository.js';
import { IUser, UserModel } from '../models/userModel.js';

// Repository for users collection handling persistence and user queries
export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }

  // Find a user document by normalized email address
  async findByEmail(email: string): Promise<IUser | null> {
    return this.findOne({ email: email.toLowerCase().trim() });
  }

  // Update password hash for a specific user ID
  async updatePassword(userId: string, newPasswordHash: string): Promise<IUser | null> {
    return this.updateById(userId, { $set: { passwordHash: newPasswordHash } });
  }

  // Set user verified status to true
  async markVerified(userId: string): Promise<IUser | null> {
    return this.updateById(userId, { $set: { isVerified: true } });
  }
}

export const userRepository = new UserRepository();

