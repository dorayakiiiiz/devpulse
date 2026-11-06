import { z } from 'zod';

// Schema validating public status page slug parameter
export const statusSlugParamSchema = z.object({
  params: z.object({
    slug: z.string().trim().min(1, 'Status page slug is required').max(100),
  }),
});

