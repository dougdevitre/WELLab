import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Format Zod validation errors into a human-readable list.
 */
function formatZodErrors(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
}

/**
 * Creates a middleware that validates `req.body` against a Zod schema.
 * On success the parsed (and potentially transformed) body replaces `req.body`.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = formatZodErrors(result.error);
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Request body validation failed: ${details.join('; ')}`,
          details,
        },
      });
      return;
    }

    // Replace body with the parsed & coerced output
    req.body = result.data;
    next();
  };
}

/**
 * Creates a middleware that validates `req.query` against a Zod schema.
 * On success the parsed query replaces `req.query`.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const details = formatZodErrors(result.error);
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Query parameter validation failed: ${details.join('; ')}`,
          details,
        },
      });
      return;
    }

    // Overwrite query with parsed values
    req.query = result.data;
    next();
  };
}
