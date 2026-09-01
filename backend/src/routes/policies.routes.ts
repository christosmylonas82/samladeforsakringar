import { Router } from 'express';
import {
  createPolicy,
  deletePolicy,
  getPolicy,
  listPolicies,
  updatePolicy,
} from '../controllers/policies.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(listPolicies));
router.post('/', asyncHandler(createPolicy));
router.get('/:id', asyncHandler(getPolicy));
router.patch('/:id', asyncHandler(updatePolicy));
router.delete('/:id', asyncHandler(deletePolicy));

export default router;
