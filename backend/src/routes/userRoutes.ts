import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} from '../controllers/userController.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from '../schemas/userSchemas.js';

const router = Router();

// Retrieve user profile
router.get('/profile', getProfile);

// Update user display name
router.put('/profile', validateRequest(updateProfileSchema), updateProfile);

// Change user password requiring current password verification
router.put('/change-password', validateRequest(changePasswordSchema), changePassword);

// Permanently delete user account confirming with current password
router.delete('/account', validateRequest(deleteAccountSchema), deleteAccount);

export default router;

