import { Router } from 'express';
import { validateRequest } from '../middlewares/validateRequest.js';
import { statusSlugParamSchema } from '../schemas/statusPageSchemas.js';
import { clearStatusPageCache } from '../controllers/statusPageController.js';

const router = Router();

// Admin endpoint clearing cached status page
router.post('/clear-cache/:slug', validateRequest(statusSlugParamSchema), clearStatusPageCache);

export default router;

