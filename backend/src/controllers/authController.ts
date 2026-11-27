import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/appError.js';
import { env } from '../config/env.js';

export const REFRESH_COOKIE_NAME = 'refreshToken';
const DEFAULT_REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Convert JWT duration strings (e.g. 7d, 12h, 30m, 60s) into milliseconds for cookie maxAge
function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    return DEFAULT_REFRESH_MAX_AGE_MS;
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}

// Base cookie configuration options enforcing HttpOnly and standard lax isolation
export const baseCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

// Refresh token cookie configuration with retention lifetime synchronized to JWT_REFRESH_EXPIRES_IN
export const refreshCookieOptions = {
  ...baseCookieOptions,
  maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN),
};

// Handle account registration and dispatch email verification OTP
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.register(req.body);
    sendSuccess(res, result, 'Registration initiated. Please enter the verification code sent to your email.', 201);
  } catch (error) {
    next(error);
  }
}

// Verify email OTP, activate account and issue access and refresh tokens
export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, accessToken, refreshToken } = await authService.verifyEmail(req.body);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
    sendSuccess(res, { user, accessToken }, 'Account verified and activated successfully', 200);
  } catch (error) {
    next(error);
  }
}

// Resend verification OTP code for pending accounts
export async function resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.resendVerificationOtp(req.body.email);
    sendSuccess(res, null, 'Verification code has been resent to your email', 200);
  } catch (error) {
    next(error);
  }
}

// Handle authentication login, set refresh cookie and return access token in response payload
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, accessToken, refreshToken } = await authService.login(req.body);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
    sendSuccess(res, { user, accessToken }, 'Login successful', 200);
  } catch (error) {
    next(error);
  }
}

// Verify refresh cookie and issue rotated tokens
export async function refreshAccessToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const incomingRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!incomingRefreshToken) {
      throw new AppError('Refresh token required', 401);
    }

    const { user, accessToken, refreshToken } = await authService.refreshToken(incomingRefreshToken);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
    sendSuccess(res, { user, accessToken }, 'Access token refreshed successfully', 200);
  } catch (error) {
    next(error);
  }
}

// Clear authenticated session cookies
export function logout(_req: Request, res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions);
  sendSuccess(res, null, 'Logged out successfully', 200);
}

// Return authenticated profile from populated context
export async function getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getCurrentUser(req.user!.id);
    sendSuccess(res, user, undefined, 200);
  } catch (error) {
    next(error);
  }
}

// Dispatch password reset OTP verification code
export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.requestPasswordReset(req.body.email);
    sendSuccess(res, null, 'Verification code sent to your email', 200);
  } catch (error) {
    next(error);
  }
}

// Confirm OTP verification and update new password
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.resetPassword(req.body);
    sendSuccess(res, null, 'Password has been reset successfully', 200);
  } catch (error) {
    next(error);
  }
}
