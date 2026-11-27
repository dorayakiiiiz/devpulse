import { z } from 'zod';
import { isSafeMonitorUrl } from '../utils/urlValidator.js';

const urlValidation = z
  .string({ required_error: 'Target URL is required' })
  .trim()
  .url('Invalid URL format')
  .refine((val) => val.startsWith('http://') || val.startsWith('https://'), {
    message: 'URL must start with http:// or https://',
  })
  .refine(isSafeMonitorUrl, {
    message: 'Private or internal network URLs are not allowed',
  });

const intervalValidation = z.union([z.literal(30), z.literal(60), z.literal(300)], {
  errorMap: () => ({ message: 'Interval must be either 30, 60, or 300 seconds' }),
});

// Validation schema for creating a new monitor
export const createMonitorSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Monitor name is required' })
      .trim()
      .min(1, 'Monitor name cannot be empty')
      .max(100, 'Monitor name cannot exceed 100 characters'),
    url: urlValidation,
    method: z.enum(['GET', 'POST', 'HEAD']).default('GET'),
    headers: z.record(z.string(), z.string()).optional().default({}),
    interval: intervalValidation,
  }),
});

// Validation schema for updating monitor configuration
export const updateMonitorSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid monitor ID format'),
  }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Monitor name cannot be empty')
      .max(100, 'Monitor name cannot exceed 100 characters')
      .optional(),
    url: urlValidation.optional(),
    method: z.enum(['GET', 'POST', 'HEAD']).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    interval: intervalValidation.optional(),
  }),
});

// Validation schema for routes requiring a monitor ID param
export const monitorIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid monitor ID format'),
  }),
});

// Validation schema for querying monitor metrics
export const queryMonitorMetricsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid monitor ID format'),
  }),
  query: z.object({
    range: z.enum(['1h', '24h', '7d']).optional(),
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive integer')
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 50)),
  }),
});

