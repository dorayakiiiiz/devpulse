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

  // Find a user document by public status slug
  async findBySlug(slug: string): Promise<IUser | null> {
    return this.findOne({ slug: slug.toLowerCase().trim() });
  }

  // Update password hash for a specific user ID
  async updatePassword(userId: string, newPasswordHash: string): Promise<IUser | null> {
    return this.updateById(userId, { $set: { passwordHash: newPasswordHash } });
  }

  // Set user verified status to true
  async markVerified(userId: string): Promise<IUser | null> {
    return this.updateById(userId, { $set: { isVerified: true } });
  }

  // Update user profile fields (name and/or unique slug)
  async updateProfileData(userId: string, data: { name?: string; slug?: string }): Promise<IUser | null> {
    const updateFields: Record<string, string> = {};
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.slug !== undefined) updateFields.slug = data.slug;
    return this.updateById(userId, { $set: updateFields });
  }

  // Atomically increment token version to invalidate active refresh tokens
  async incrementTokenVersion(userId: string): Promise<IUser | null> {
    return this.updateById(userId, { $inc: { tokenVersion: 1 } });
  }
}

export const userRepository = new UserRepository();

