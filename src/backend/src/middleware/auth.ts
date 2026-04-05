import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Authentication middleware stub.
 * Checks for a Bearer token in the Authorization header.
 * Currently performs placeholder validation -- replace with real JWT/OAuth verification.
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

  // Placeholder validation: accept any non-empty token.
  // TODO: Replace with real JWT verification or OAuth token introspection.
  if (!token || token.length < 1) {
    logger.warn('Empty bearer token', { path: req.path });
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
    });
    return;
  }

  logger.debug('Auth passed (placeholder)', { path: req.path });
  next();
}
