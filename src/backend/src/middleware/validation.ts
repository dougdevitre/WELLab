import { Request, Response, NextFunction } from 'express';
import { ValidationSchema } from '../types';

/**
 * Creates a request body validation middleware from a simple schema definition.
 * Checks required fields and basic type constraints.
 *
 * @param schema - Validation schema specifying required fields and expected types
 * @returns Express middleware that validates req.body against the schema
 */
export function validateBody(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const body = req.body;

    if (!body || typeof body !== 'object') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Request body must be a JSON object' },
      });
      return;
    }

    // Check required fields
    if (schema.required) {
      const missing = schema.required.filter((field) => !(field in body));
      if (missing.length > 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Missing required fields: ${missing.join(', ')}`,
            details: { missingFields: missing },
          },
        });
        return;
      }
    }

    // Check types
    if (schema.types) {
      const typeErrors: string[] = [];
      for (const [field, expectedType] of Object.entries(schema.types)) {
        if (!(field in body)) continue; // skip missing optional fields
        const value = body[field];
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== expectedType) {
          typeErrors.push(`${field}: expected ${expectedType}, got ${actualType}`);
        }
      }
      if (typeErrors.length > 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Type errors: ${typeErrors.join('; ')}`,
            details: { typeErrors },
          },
        });
        return;
      }
    }

    next();
  };
}
