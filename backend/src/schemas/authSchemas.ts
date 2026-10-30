import { z } from 'zod';

// Registration payload validation schema
export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must not exceed 50 characters'),
    email: z.string().email('Invalid email address format'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
  }),
});

// Verification email confirmation validation schema
export const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 numeric digits'),
  }),
});

// Resend verification OTP validation schema
export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
  }),
});

// Login payload validation schema
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    password: z.string().min(1, 'Password is required'),
  }),
});

// Forgot password request validation schema
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
  }),
});

// Password reset confirmation validation schema
export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 numeric digits'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
  }),
});
