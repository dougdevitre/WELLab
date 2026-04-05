import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { UserPayload } from '../types/express';

/**
 * Decode a Base64url-encoded JWT payload (middle segment).
 * Does NOT verify the signature -- real deployments should use a
 * library such as `jsonwebtoken` with a proper secret/key.
 */
function decodeJwtPayload(token: string): UserPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    // Base64url -> Base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(json) as UserPayload;
  } catch {
    return null;
  }
}

/**
 * Authentication middleware.
 * Validates the JWT structure, checks expiration, and attaches the decoded
 * user payload to `req.user`.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn('Missing Authorization header', { path: req.path, method: req.method });
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' },
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.warn('Malformed Authorization header', { path: req.path });
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authorization header must use Bearer scheme' },
    });
    return;
  }

  const token = parts[1];
  if (!token) {
    logger.warn('Empty bearer token', { path: req.path });
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
    });
    return;
  }

  // Decode and validate the JWT payload
  const payload = decodeJwtPayload(token);
  if (!payload) {
    logger.warn('Failed to decode JWT', { path: req.path });
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Malformed JWT token' },
    });
    return;
  }

  // Validate required claims
  if (!payload.sub || !payload.exp || !payload.iss) {
    logger.warn('JWT missing required claims', { path: req.path });
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Token missing required claims (sub, exp, iss)' },
    });
    return;
  }

  // Check expiration
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSeconds) {
    logger.warn('JWT expired', { path: req.path, exp: payload.exp });
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Token has expired' },
    });
    return;
  }

  // Attach user to request
  req.user = payload;

  logger.debug('Auth passed', { path: req.path, sub: payload.sub, role: payload.role });
  next();
}

/**
 * Role-based access control middleware factory.
 * Must be used AFTER `authMiddleware` so that `req.user` is populated.
 */
export function requireRole(...roles: Array<'researcher' | 'participant' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Insufficient role', {
        path: req.path,
        required: roles,
        actual: req.user.role,
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Requires one of the following roles: ${roles.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
}
