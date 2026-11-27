import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/appError.js';
import { env } from '../config/env.js';

// Rate limiting middleware protecting authentication endpoints against brute-force attacks
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req, _res, next) => {
    next(new AppError('Too many authentication attempts from this IP, please try again after 15 minutes', 429));
  },
});

// Rate limiting middleware protecting OTP endpoints against brute-force spam
export const otpIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req, _res, next) => {
    next(new AppError('Too many requests from this IP, please try again after 15 minutes', 429));
  },
});

// Rate limiting middleware protecting instant ping endpoints against user spam
export const instantPingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  keyGenerator: (req) => req.user!.id,
  handler: (_req, _res, next) => {
    next(new AppError('Instant ping limit exceeded. Maximum 5 requests per minute allowed.', 429));
  },
});
