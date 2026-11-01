import { z } from 'zod';

// Profile update validation schema
export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must not exceed 50 characters'),
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

