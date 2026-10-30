import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/appError.js';

// Rate limiting middleware protecting OTP endpoints against brute-force spam
export const otpIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError('Too many requests from this IP, please try again after 15 minutes', 429));
  },
});
