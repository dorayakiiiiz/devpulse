import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError.js';
import { UserRole } from '../models/userModel.js';

// Higher-order middleware factory enforcing role-based access authorization guards
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication session required', 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError('Access forbidden: insufficient permissions', 403));
      return;
    }

    next();
  };
}

// Convenience middleware guard strictly requiring admin privileges
export const requireAdmin = requireRole('admin');

