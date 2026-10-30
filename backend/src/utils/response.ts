import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: unknown;
}

// Send standard successful JSON response
export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode = 200): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

// Send standard error JSON response
export function sendError(res: Response, error: string, statusCode = 400, details?: unknown): Response {
  return res.status(statusCode).json({
    success: false,
    error,
    ...(details !== undefined ? { details } : {}),
  });
}
