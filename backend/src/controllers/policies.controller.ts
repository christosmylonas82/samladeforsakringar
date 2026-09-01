import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';

const createPolicySchema = z.object({
  provider: z.string().min(1),
  policyNumber: z.string().min(1),
  type: z.enum([
    'HEMFORSAKRING',
    'VILLAFORSAKRING',
    'BILFORSAKRING',
    'LIVFORSAKRING',
    'SJUKFORSAKRING',
    'OLYCKSFALLSFORSAKRING',
    'DJURFORSAKRING',
    'RESEFORSAKRING',
    'ANSVARSFORSAKRING',
    'OVRIGT',
  ]),
  premiumAmount: z.number().int().nonnegative(),
  paymentFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).default('YEARLY'),
  coverageAmount: z.number().int().nonnegative().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

async function assertOwnedPolicy(policyId: string, userId: string) {
  const policy = await prisma.insurancePolicy.findUnique({ where: { id: policyId } });
  if (!policy || policy.deletedAt) {
    throw new HttpError(404, 'Policy not found');
  }
  if (policy.userId !== userId) {
    throw new HttpError(403, 'Not authorized to access this policy');
  }
  return policy;
}

export async function listPolicies(req: Request, res: Response) {
  const policies = await prisma.insurancePolicy.findMany({
    where: { userId: req.user!.userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  res.json(policies);
}

export async function createPolicy(req: Request, res: Response) {
  const data = createPolicySchema.parse(req.body);
  const policy = await prisma.insurancePolicy.create({
    data: { ...data, userId: req.user!.userId },
  });
  res.status(201).json(policy);
}

export async function getPolicy(req: Request, res: Response) {
  const policy = await assertOwnedPolicy(req.params.id, req.user!.userId);
  res.json(policy);
}

export async function updatePolicy(req: Request, res: Response) {
  await assertOwnedPolicy(req.params.id, req.user!.userId);
  const data = createPolicySchema.partial().parse(req.body);
  const policy = await prisma.insurancePolicy.update({
    where: { id: req.params.id },
    data,
  });
  res.json(policy);
}

export async function deletePolicy(req: Request, res: Response) {
  await assertOwnedPolicy(req.params.id, req.user!.userId);
  await prisma.insurancePolicy.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date() },
  });
  res.status(204).send();
}
