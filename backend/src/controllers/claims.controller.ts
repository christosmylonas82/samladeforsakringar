import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';

const createClaimSchema = z.object({
  policyId: z.string().uuid(),
  description: z.string().min(1),
  incidentDate: z.coerce.date(),
  amountClaimed: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

const updateClaimSchema = z.object({
  status: z.enum(['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PAID']).optional(),
  amountApproved: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

async function assertOwnedClaim(claimId: string, userId: string) {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!claim) {
    throw new HttpError(404, 'Claim not found');
  }
  if (claim.userId !== userId) {
    throw new HttpError(403, 'Not authorized to access this claim');
  }
  return claim;
}

export async function listClaims(req: Request, res: Response) {
  const claims = await prisma.claim.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(claims);
}

export async function createClaim(req: Request, res: Response) {
  const data = createClaimSchema.parse(req.body);

  const policy = await prisma.insurancePolicy.findUnique({ where: { id: data.policyId } });
  if (!policy || policy.deletedAt || policy.userId !== req.user!.userId) {
    throw new HttpError(404, 'Policy not found');
  }

  const claim = await prisma.claim.create({
    data: { ...data, userId: req.user!.userId },
  });
  res.status(201).json(claim);
}

export async function getClaim(req: Request, res: Response) {
  const claim = await assertOwnedClaim(req.params.id, req.user!.userId);
  res.json(claim);
}

export async function updateClaim(req: Request, res: Response) {
  await assertOwnedClaim(req.params.id, req.user!.userId);
  const data = updateClaimSchema.parse(req.body);

  const claim = await prisma.claim.update({
    where: { id: req.params.id },
    data: {
      ...data,
      resolvedAt: data.status && data.status !== 'SUBMITTED' && data.status !== 'IN_REVIEW'
        ? new Date()
        : undefined,
    },
  });
  res.json(claim);
}
