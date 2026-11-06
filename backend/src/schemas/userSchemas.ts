import { z } from 'zod';

// Profile update validation schema
export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name must not exceed 50 characters').optional(),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .min(3, 'Slug must be at least 3 characters')
        .max(50, 'Slug must not exceed 50 characters')
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric and can contain hyphens')
        .optional(),
    })
    .refine((data) => data.name !== undefined || data.slug !== undefined, {
      message: 'At least one field (name or slug) must be provided',
    }),
});

// Change password validation schema
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
  }),
});

// Delete account confirmation schema
export const deleteAccountSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Password is required to confirm account deletion'),
  }),
});

