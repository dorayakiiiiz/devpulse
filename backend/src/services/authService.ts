import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/userRepository.js';
import { otpRepository } from '../repositories/otpRepository.js';
import { emailService } from './emailService.js';
import { memoryCache } from '../utils/cache.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';
import { IUser } from '../models/userModel.js';

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface VerifyEmailDto {
  email: string;
  otp: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: 'member' | 'admin';
  isVerified: boolean;
  createdAt: string;
}

export interface AuthSessionResult {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
}

export interface ResetPasswordDto {
  email: string;
  otp: string;
  newPassword: string;
}

const ONE_HOUR_SECONDS = 3600;

// Application service encapsulating authentication and OTP verification business logic
export class AuthService {
  // Initiate registration, persist pending user and dispatch registration OTP
  async register(data: RegisterDto): Promise<{ email: string }> {
    const normalizedEmail = data.email.toLowerCase().trim();
    const cooldownKey = `otp_cooldown:${normalizedEmail}`;

    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser && existingUser.isVerified) {
      throw new AppError('Email already registered', 409);
    }

    if (memoryCache.has(cooldownKey)) {
      throw new AppError('Please wait 60 seconds before requesting a new code', 429);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    if (existingUser && !existingUser.isVerified) {
      await userRepository.updateById(existingUser._id.toString(), {
        name: data.name.trim(),
        passwordHash,
      });
    } else {
      await userRepository.create({
        name: data.name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'member',
        isVerified: false,
      });
    }

    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const codeSalt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(rawOtp, codeSalt);

    await otpRepository.upsertOtp(normalizedEmail, codeHash);
    memoryCache.set(cooldownKey, true, 60);

    emailService.sendRegistrationOtpEmail(normalizedEmail, rawOtp);

    return { email: normalizedEmail };
  }

  // Verify registration OTP code, activate account and issue auth session tokens
  async verifyEmail(data: VerifyEmailDto): Promise<AuthSessionResult> {
    const normalizedEmail = data.email.toLowerCase().trim();
    const lockoutKey = `otp_lockout:${normalizedEmail}`;

    if (memoryCache.has(lockoutKey)) {
      throw new AppError('Too many failed attempts. Verification is locked for 1 hour. Please try again later.', 429);
    }

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    if (user.isVerified) {
      throw new AppError('Email is already verified', 400);
    }

    const otpRecord = await otpRepository.findByEmail(normalizedEmail);
    if (!otpRecord) {
      throw new AppError('Verification code is invalid or has expired', 400);
    }

    const isMatch = await bcrypt.compare(data.otp, otpRecord.codeHash);
    if (!isMatch) {
      const nextAttempts = otpRecord.attempts + 1;
      if (nextAttempts >= 5) {
        await otpRepository.deleteByEmail(normalizedEmail);
        memoryCache.set(lockoutKey, true, ONE_HOUR_SECONDS);
        throw new AppError('Maximum attempts exceeded. This action is temporarily locked for 1 hour. Please try again later.', 429);
      }

      await otpRepository.incrementAttempts(normalizedEmail);
      throw new AppError('Verification code is invalid or has expired', 400);
    }

    await userRepository.markVerified(user._id.toString());
    await otpRepository.deleteByEmail(normalizedEmail);

    user.isVerified = true;
    const tokens = this.generateTokens(user._id.toString(), user.role, user.tokenVersion ?? 0);

    return {
      user: this.mapToDto(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // Resend registration verification OTP code respecting 60s cooldown
  async resendVerificationOtp(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const lockoutKey = `otp_lockout:${normalizedEmail}`;
    const cooldownKey = `otp_cooldown:${normalizedEmail}`;

    if (memoryCache.has(lockoutKey)) {
      throw new AppError('Too many failed attempts. Verification is locked for 1 hour. Please try again later.', 429);
    }

    if (memoryCache.has(cooldownKey)) {
      throw new AppError('Please wait 60 seconds before requesting a new code', 429);
    }

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new AppError('Email does not exist', 404);
    }

    if (user.isVerified) {
      throw new AppError('Email is already verified', 400);
    }

    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const codeSalt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(rawOtp, codeSalt);

    await otpRepository.upsertOtp(normalizedEmail, codeHash);
    memoryCache.set(cooldownKey, true, 60);

    emailService.sendRegistrationOtpEmail(normalizedEmail, rawOtp);
  }

  // Authenticate user credentials and enforce verified account constraint
  async login(data: LoginDto): Promise<AuthSessionResult> {
    const normalizedEmail = data.email.toLowerCase().trim();

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isVerified) {
      throw new AppError('Please verify your email address before logging in', 403);
    }

    const tokens = this.generateTokens(user._id.toString(), user.role, user.tokenVersion ?? 0);

    return {
      user: this.mapToDto(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // Verify refresh token and issue rotated session tokens
  async refreshToken(token: string): Promise<AuthSessionResult> {
    let decoded: { id: string; tokenVersion?: number };
    try {
      decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string; tokenVersion?: number };
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await userRepository.findById(decoded.id);
    if (!user) {
      throw new AppError('User account not found', 401);
    }

    if (!user.isVerified) {
      throw new AppError('Please verify your email address before continuing', 403);
    }

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      throw new AppError('Invalid or revoked refresh token', 401);
    }

    const tokens = this.generateTokens(user._id.toString(), user.role, user.tokenVersion ?? 0);

    return {
      user: this.mapToDto(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // Retrieve current authenticated user profile
  async getCurrentUser(userId: string): Promise<AuthUserDto> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User account not found', 401);
    }

    return this.mapToDto(user);
  }

  // Handle forgot password request with 60s cooldown and atomic OTP upsert
  async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const lockoutKey = `otp_lockout:${normalizedEmail}`;
    const cooldownKey = `otp_cooldown:${normalizedEmail}`;

    if (memoryCache.has(lockoutKey)) {
      throw new AppError('Too many failed attempts. Password reset is locked for 1 hour. Please try again later.', 429);
    }

    if (memoryCache.has(cooldownKey)) {
      throw new AppError('Please wait 60 seconds before requesting a new code', 429);
    }

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new AppError('Email does not exist', 404);
    }

    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(rawOtp, salt);

    await otpRepository.upsertOtp(normalizedEmail, codeHash);
    memoryCache.set(cooldownKey, true, 60);

    emailService.sendPasswordResetOtpEmail(normalizedEmail, rawOtp);
  }

  // Verify OTP code and update user password with 1-hour lockout protection upon 5 failures
  async resetPassword(data: ResetPasswordDto): Promise<void> {
    const normalizedEmail = data.email.toLowerCase().trim();
    const lockoutKey = `otp_lockout:${normalizedEmail}`;

    if (memoryCache.has(lockoutKey)) {
      throw new AppError('Too many failed attempts. Password reset is locked for 1 hour. Please try again later.', 429);
    }

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    const otpRecord = await otpRepository.findByEmail(normalizedEmail);
    if (!otpRecord) {
      throw new AppError('Verification code is invalid or has expired', 400);
    }

    const isMatch = await bcrypt.compare(data.otp, otpRecord.codeHash);
    if (!isMatch) {
      const nextAttempts = otpRecord.attempts + 1;
      if (nextAttempts >= 5) {
        await otpRepository.deleteByEmail(normalizedEmail);
        memoryCache.set(lockoutKey, true, ONE_HOUR_SECONDS);
        throw new AppError('Maximum attempts exceeded. This action is temporarily locked for 1 hour. Please try again later.', 429);
      }

      await otpRepository.incrementAttempts(normalizedEmail);
      throw new AppError('Verification code is invalid or has expired', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(data.newPassword, salt);

    await userRepository.updatePassword(user._id.toString(), newPasswordHash);
    await userRepository.incrementTokenVersion(user._id.toString());
    await otpRepository.deleteByEmail(normalizedEmail);
  }

  // Generate signed access and refresh tokens
  private generateTokens(userId: string, role: string, tokenVersion: number): { accessToken: string; refreshToken: string } {
    const accessToken = jwt.sign(
      { id: userId, role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    const refreshToken = jwt.sign(
      { id: userId, tokenVersion },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    return { accessToken, refreshToken };
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

export const authService = new AuthService();
