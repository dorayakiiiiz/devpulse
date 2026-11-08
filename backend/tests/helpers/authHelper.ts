import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../../src/models/userModel.js';
import { env } from '../../src/config/env.js';

interface CreateTestUserOptions {
  email?: string;
  name?: string;
  password?: string;
  role?: UserRole;
  isVerified?: boolean;
}

// Helper to seed a test user and generate valid access/refresh tokens
export async function createTestUser(options: CreateTestUserOptions = {}) {
  const email = (options.email ?? `user_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`).toLowerCase();
  const name = options.name ?? 'Test User';
  const rawPassword = options.password ?? 'Password123!';
  const role = options.role ?? 'member';
  const isVerified = options.isVerified ?? true;
  const slug = `slug-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(rawPassword, salt);

  const user = await User.create({
    name,
    email,
    passwordHash,
    role,
    slug,
    isVerified,
    tokenVersion: 0,
  });

  const accessToken = jwt.sign(
    { id: user._id.toString(), role: user.role },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user._id.toString(), tokenVersion: user.tokenVersion },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return {
    user,
    rawPassword,
    accessToken,
    refreshToken,
    authHeader: `Bearer ${accessToken}`,
    refreshCookie: `refreshToken=${refreshToken}`,
  };
}

