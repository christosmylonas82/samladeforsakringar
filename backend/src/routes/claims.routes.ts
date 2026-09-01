import { Router } from 'express';
import {
  createClaim,
  getClaim,
  listClaims,
  updateClaim,
} from '../controllers/claims.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(listClaims));
router.post('/', asyncHandler(createClaim));
router.get('/:id', asyncHandler(getClaim));
router.patch('/:id', asyncHandler(updateClaim));

export default router;
