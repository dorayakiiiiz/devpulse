export interface AuthenticatedUserPayload {
  id: string;
  role: 'member' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserPayload;
    }
  }
}

