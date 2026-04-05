import { Request } from 'express';

export interface UserPayload {
  sub: string;
  role: 'researcher' | 'participant' | 'admin';
  iss: string;
  exp: number;
  iat?: number;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      requestId?: string;
    }
  }
}
