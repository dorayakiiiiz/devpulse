import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';
import { sendError } from '../utils/response.js';

// Centralized express error handling middleware formatting all error responses
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  if (err instanceof ZodError) {
    return sendError(res, 'Validation error', 400, err.flatten().fieldErrors);
  }

  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode);
  }

  console.error('[Unhandled Error]', err);
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error');
  return sendError(res, message, 500);
}
