import { Router } from 'express';
import {
  register,
  verifyEmail,
  resendVerification,
  login,
  refreshAccessToken,
  logout,
  getCurrentUser,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authLimiter, otpIpLimiter } from '../middlewares/rateLimitMiddleware.js';
import {
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/authSchemas.js';

const router = Router();

// Registration initiation route with verification OTP dispatch
router.post('/register', authLimiter, validateRequest(registerSchema), register);

// Email verification confirmation and account activation route
router.post('/verify-email', otpIpLimiter, validateRequest(verifyEmailSchema), verifyEmail);

// Resend registration verification OTP with rate limiting protection
router.post('/resend-verification', otpIpLimiter, validateRequest(resendVerificationSchema), resendVerification);

// Public authentication login route
router.post('/login', authLimiter, validateRequest(loginSchema), login);

// Token rotation and session renewal route
router.post('/refresh-token', refreshAccessToken);

// Authenticated session termination route
router.post('/logout', logout);

// Authenticated session verification route
router.get('/me', authenticate, getCurrentUser);

// Password recovery initiation route with IP rate-limiting protection
router.post('/forgot-password', otpIpLimiter, validateRequest(forgotPasswordSchema), forgotPassword);

// Password reset confirmation route
router.post('/reset-password', otpIpLimiter, validateRequest(resetPasswordSchema), resetPassword);

export default router;
