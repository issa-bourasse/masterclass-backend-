import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { userRoutes } from './routes/users';
import { streamRoutes } from './routes/streams';
import { webhookRoutes } from './routes/webhooks';
import { followRoutes } from './routes/follow';
import { analyticsRoutes } from './routes/analytics';
import { categoryRoutes } from './routes/categories';
import { errorHandler, rateLimit } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting for API routes
app.use('/api', rateLimit({ windowMs: 60000, max: 100 }));

// Parse JSON bodies (except for webhook routes which need raw body)
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/categories', categoryRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 StreamHub server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 API endpoints available:`);
  console.log(`   - /api/users`);
  console.log(`   - /api/streams`);
  console.log(`   - /api/follow`);
  console.log(`   - /api/analytics`);
  console.log(`   - /api/categories`);
});

export default app;
