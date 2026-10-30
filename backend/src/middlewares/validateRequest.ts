import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

// Middleware validating request inputs against Zod schema and forwarding errors to errorHandler
export function validateRequest(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      // Forward validation error to centralized errorHandler middleware via next(error)
      next(error);
    }
  };
}
