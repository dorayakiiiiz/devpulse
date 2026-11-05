import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

// Middleware validating request inputs against Zod schema and forwarding errors to errorHandler
export function validateRequest(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) req.query = parsed.query;
      if (parsed.params !== undefined) req.params = parsed.params;

      next();
    } catch (error) {
      // Forward validation error to centralized errorHandler middleware via next(error)
      next(error);
    }
  };
}
