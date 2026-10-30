import { Router } from 'express';
import {
  register,
  verifyEmail,
  resendVerification,
  login,
  logout,
  getCurrentUser,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { otpIpLimiter } from '../middlewares/rateLimitMiddleware.js';
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
router.post('/register', validateRequest(registerSchema), register);

// Email verification confirmation and account activation route
router.post('/verify-email', validateRequest(verifyEmailSchema), verifyEmail);

// Resend registration verification OTP with rate limiting protection
router.post('/resend-verification', otpIpLimiter, validateRequest(resendVerificationSchema), resendVerification);

// Public authentication login route
router.post('/login', validateRequest(loginSchema), login);

// Authenticated session termination route
router.post('/logout', authenticate, logout);

// Authenticated session verification route
router.get('/me', authenticate, getCurrentUser);

// Password recovery initiation route with IP rate-limiting protection
router.post('/forgot-password', otpIpLimiter, validateRequest(forgotPasswordSchema), forgotPassword);

// Password reset confirmation route
router.post('/reset-password', validateRequest(resetPasswordSchema), resetPassword);

export default router;
