import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';
import { HttpError } from '../middleware/errorHandler.js';

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  gdprConsent: z.literal(true),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  const { email, name, password, gdprConsent } = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, 'A user with this email already exists');
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      gdprConsent,
      consentDate: new Date(),
    },
  });

  const token = signToken({ userId: user.id, role: user.role });
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
}

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId } });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
}
