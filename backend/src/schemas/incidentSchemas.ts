import { z } from 'zod';

export const incidentIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid incident ID format'),
  }),
});

export const queryIncidentsSchema = z.object({
  query: z.object({
    status: z.enum(['ongoing', 'resolved']).optional(),
    monitorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid monitor ID format').optional(),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 50)),
    skip: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 0)),
  }),
});

export type QueryIncidentsQuery = z.infer<typeof queryIncidentsSchema>['query'];
