import { Router } from 'express';
import { validateRequest } from '../middlewares/validateRequest.js';
import { statusSlugParamSchema } from '../schemas/statusPageSchemas.js';
import { getStatusPage } from '../controllers/statusPageController.js';

const router = Router();

// Public status page endpoint
router.get('/:slug', validateRequest(statusSlugParamSchema), getStatusPage);

export default router;

