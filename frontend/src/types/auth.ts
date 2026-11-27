export type UserRole = 'member' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  slug: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  newPassword: string;
}

export interface AuthSessionResponse {
  user: AuthUser;
  accessToken: string;
}

export interface UpdateProfilePayload {
  name?: string;
  slug?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

