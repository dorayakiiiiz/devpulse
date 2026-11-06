import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/userRepository.js';
import { monitorRepository } from '../repositories/monitorRepository.js';
import { incidentRepository } from '../repositories/incidentRepository.js';
import { pingMetricRepository } from '../repositories/pingMetricRepository.js';
import { memoryCache } from '../utils/cache.js';
import { AppError } from '../utils/appError.js';
import { IUser } from '../models/userModel.js';
import { AuthUserDto } from './authService.js';
import { statusPageService } from './statusPageService.js';

export interface UpdateProfileDto {
  name?: string;
  slug?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

// Application service managing user profile operations and credentials updates
export class UserService {
  // Retrieve user profile by primary key ID
  async getUserProfile(userId: string): Promise<AuthUserDto> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    return this.mapToDto(user);
  }

  // Update user display name and/or public status slug with uniqueness check
  async updateProfile(userId: string, data: UpdateProfileDto): Promise<AuthUserDto> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    const updateData: { name?: string; slug?: string } = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }

    if (data.slug !== undefined) {
      const normalizedSlug = data.slug.trim().toLowerCase();
      if (normalizedSlug !== user.slug) {
        const existingSlugUser = await userRepository.findBySlug(normalizedSlug);
        if (existingSlugUser && existingSlugUser._id.toString() !== userId) {
          throw new AppError('Status page slug is already in use by another account', 409);
        }
        updateData.slug = normalizedSlug;
        // Invalidate status page routing and data cache for previous slug and user
        statusPageService.invalidateSlug(user.slug);
        statusPageService.invalidateCache(userId);
      }
    }

    const updatedUser = await userRepository.updateProfileData(userId, updateData);
    if (!updatedUser) {
      throw new AppError('User account not found', 404);
    }

    return this.mapToDto(updatedUser);
  }

  // Verify current password and update with newly hashed password
  async changePassword(userId: string, data: ChangePasswordDto): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(data.newPassword, salt);

    await userRepository.updatePassword(userId, newPasswordHash);
    await userRepository.incrementTokenVersion(userId);
  }

  // Confirm password and delete user account permanently with cascade resource cleanup
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Incorrect password. Account deletion aborted.', 400);
    }

    // Invalidate public status page routing and data cache
    statusPageService.invalidateSlug(user.slug);
    statusPageService.invalidateCache(userId);

    // Retrieve monitors to evict memory caches and remove associated time-series metrics
    const monitors = await monitorRepository.findByUser(userId);
    for (const monitor of monitors) {
      const monitorIdStr = monitor._id.toString();
      memoryCache.del(`ongoing_incident:${monitorIdStr}`);
      memoryCache.del(`ping_cooldown:${monitorIdStr}`);
    }

    const monitorIds = monitors.map((m) => m._id);
    await pingMetricRepository.deleteByMonitors(monitorIds);
    await incidentRepository.deleteByUser(userId);
    await monitorRepository.deleteByUser(userId);
    await userRepository.deleteById(userId);
  }

  // Format database document to client DTO representation
  private mapToDto(user: IUser): AuthUserDto {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      slug: user.slug,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

export const userService = new UserService();

