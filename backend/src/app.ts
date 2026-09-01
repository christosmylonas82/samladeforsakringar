import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import policiesRoutes from './routes/policies.routes.js';
import claimsRoutes from './routes/claims.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

app.set('trust proxy', process.env.TRUST_PROXY === 'true');

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/policies', policiesRoutes);
app.use('/api/claims', claimsRoutes);

app.use(errorHandler);
