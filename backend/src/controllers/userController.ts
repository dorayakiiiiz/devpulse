import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService.js';
import { sendSuccess } from '../utils/response.js';
import { REFRESH_COOKIE_NAME, baseCookieOptions } from './authController.js';

// Retrieve authenticated user profile
export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await userService.getUserProfile(req.user!.id);
    sendSuccess(res, profile, undefined, 200);
  } catch (error) {
    next(error);
  }
}

// Update user display name
export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await userService.updateProfile(req.user!.id, req.body);
    sendSuccess(res, profile, 'Profile updated successfully', 200);
  } catch (error) {
    next(error);
  }
}

// Change user password after verifying current credentials
export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await userService.changePassword(req.user!.id, req.body);
    sendSuccess(res, null, 'Password changed successfully', 200);
  } catch (error) {
    next(error);
  }
}

// Delete user account permanently and clear session cookie
export async function deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await userService.deleteAccount(req.user!.id, req.body.password);
    res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions);
    sendSuccess(res, null, 'Account deleted successfully', 200);
  } catch (error) {
    next(error);
  }
}

