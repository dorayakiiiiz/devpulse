import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthenticatedUserPayload } from '../types/express.js';
import { AppError } from '../utils/appError.js';

interface JwtPayloadDecoded {
  id: string;
  role: 'member' | 'admin';
}

// Middleware verifying JWT session cookie and populating authenticated user context
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.accessToken || extractBearerToken(req.headers.authorization);

  if (!token) {
    next(new AppError('Authentication session required', 401));
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
    next(new AppError('Invalid or expired authentication session', 401));
  }
}

// Extract bearer token from Authorization header if present
function extractBearerToken(authHeader?: string): string | undefined {
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return undefined;
}
