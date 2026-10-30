import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError.js';

// Catch unmatched routes and forward 404 AppError to centralized errorHandler
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}
