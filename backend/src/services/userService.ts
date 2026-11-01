import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/userRepository.js';
import { AppError } from '../utils/appError.js';
import { IUser } from '../models/userModel.js';
import { AuthUserDto } from './authService.js';

export interface UpdateProfileDto {
  name: string;
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

  // Update user display name
  async updateProfile(userId: string, data: UpdateProfileDto): Promise<AuthUserDto> {
    const updatedUser = await userRepository.updateName(userId, data.name.trim());
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

  // Confirm password and delete user account permanently
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Incorrect password. Account deletion aborted.', 400);
    }
    
    // TODO: Delete all data related to user
    await userRepository.deleteById(userId);
  }

  // Format database document to client DTO representation
  private mapToDto(user: IUser): AuthUserDto {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

export const userService = new UserService();

