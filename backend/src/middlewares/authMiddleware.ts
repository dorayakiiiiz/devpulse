import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthenticatedUserPayload } from '../types/express.js';
import { AppError } from '../utils/appError.js';
import { UserRole } from '../models/userModel.js';

interface JwtPayloadDecoded {
  id: string;
  role: UserRole;
}

// Middleware verifying access token from Authorization header or query parameter
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    next(new AppError('Authentication token required', 401));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayloadDecoded;
    req.user = {
      id: decoded.id,
      role: decoded.role,
    } as AuthenticatedUserPayload;
    next();
  } catch {
    next(new AppError('Invalid or expired authentication token', 401));
  }
}

// Extract token from Authorization header or query parameter (for SSE EventSource)
function extractToken(req: Request): string | undefined {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.substring(7);
  }
  if (typeof req.query.token === 'string' && req.query.token.length > 0) {
    return req.query.token;
  }
  return undefined;
}
