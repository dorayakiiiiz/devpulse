import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';
import { env } from '../config/env.js';

const COOKIE_NAME = 'accessToken';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Cookie configuration options enforcing HttpOnly and strict site isolation
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: SEVEN_DAYS_MS,
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

// Verify email OTP, activate account and set secure HttpOnly JWT session cookie
export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token } = await authService.verifyEmail(req.body);

    res.cookie(COOKIE_NAME, token, cookieOptions);
    sendSuccess(res, user, 'Account verified and activated successfully', 200);
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

// Handle authentication login and set secure HttpOnly JWT session cookie
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token } = await authService.login(req.body);

    res.cookie(COOKIE_NAME, token, cookieOptions);
    sendSuccess(res, user, 'Login successful', 200);
  } catch (error) {
    next(error);
  }
}

// Clear authenticated session cookie
export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

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
