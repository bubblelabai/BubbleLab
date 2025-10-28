// Load environment variables first
import './config/env.js';

import { runMigrations } from './db/migrate.js';
import { seedDevUser } from './db/seed-dev-user.js';
import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { type HealthCheckResponse } from './schemas/index.js';
import { authMiddleware, getUserId, getAppType } from './middleware/auth.js';
import { verifyMonthlyLimit } from './services/subscription-validation.js';
import {
  setupErrorHandler,
  validationErrorHook,
} from './utils/error-handler.js';

// Memory monitoring function
function logMemoryUsage() {
  const usage = process.memoryUsage();
  const formatBytes = (bytes: number) =>
    (bytes / 1024 / 1024).toFixed(2) + ' MB';

  console.log('=== Memory Usage ===');
  console.log(`RSS (Resident Set Size): ${formatBytes(usage.rss)}`);
  console.log(`Heap Used: ${formatBytes(usage.heapUsed)}`);
  console.log(`Heap Total: ${formatBytes(usage.heapTotal)}`);
  console.log(`External: ${formatBytes(usage.external)}`);
  console.log(`Array Buffers: ${formatBytes(usage.arrayBuffers)}`);
  console.log('==================');
}

// Import route modules
import bubbleFlowRoutes from './routes/bubble-flows.js';
import bubbleFlowTemplateRoutes from './routes/bubble-flow-templates.js';
import credentialRoutes from './routes/credentials.js';
import oauthRoutes from './routes/oauth.js';
import webhookRoutes from './routes/webhooks.js';
import authRoutes from './routes/auth.js';
import subscriptionRoutes from './routes/subscription.js';
import joinWaitlistRoutes from './routes/join-waitlist.js';
import { startCronScheduler } from './services/cron-scheduler.js';
import aiRoutes from './routes/ai.js';
import { getBubbleFactory } from './services/bubble-factory-instance.js';

const app = new OpenAPIHono({
  defaultHook: validationErrorHook,
});

// Global error handler
setupErrorHandler(app);

// Middleware
app.use('*', logger());
app.use('*', cors());

// Apply auth middleware to specific routes that need it
app.use('/bubble-flow/*', authMiddleware);
app.use('/bubbleflow-template/*', authMiddleware);
app.use('/credentials/*', authMiddleware);
// Protect specific OAuth routes, but allow callbacks to be unauthenticated
app.use('/oauth/:provider/initiate', authMiddleware);
app.use('/oauth/:provider/refresh', authMiddleware);
app.use('/oauth/:provider/revoke/*', authMiddleware);
app.use('/auth/*', authMiddleware);
app.use('/execute-bubble-flow/*', authMiddleware);
app.use('/ai/*', authMiddleware);

// Note: webhook and execute-bubble-flow routes will handle verification internally
// They don't need auth middleware since they use their own authentication

// Health check
app.get('/', (c) => {
  const response: HealthCheckResponse = {
    message: 'BubbleLab API is running!',
    timestamp: new Date().toISOString(),
  };
  return c.json(response);
});

// Mount route modules
console.log('[DEBUG] Mounting routes...');
app.route('/bubble-flow', bubbleFlowRoutes);
app.route('/bubbleflow-template', bubbleFlowTemplateRoutes);
app.route('/credentials', credentialRoutes);
console.log('[DEBUG] Mounting OAuth routes...');
app.route('/oauth', oauthRoutes);
app.route('/webhook', webhookRoutes);
app.route('/auth', authRoutes);
app.route('/subscription', subscriptionRoutes);
app.route('/join-waitlist', joinWaitlistRoutes);
app.route('/ai', aiRoutes);
console.log('[DEBUG] All routes mounted.');

// Legacy route support for /execute-bubble-flow/:id
// This maps /execute-bubble-flow/:id to /bubble-flow/:id/execute internally
app.post('/execute-bubble-flow/:id', async (c) => {
  const id = c.req.param('id');
  const userId = getUserId(c);
  const appType = getAppType(c);
  const { allowed, currentUsage, limit } = await verifyMonthlyLimit(
    userId,
    appType
  );
  if (!allowed) {
    return c.json(
      {
        error:
          'Monthly limit exceeded, current usage, please upgrade plan or wait until next month: ' +
          currentUsage +
          ', limit: ' +
          limit,
      },
      403
    );
  }

  // Handle empty/malformed payloads gracefully
  let userPayload;
  try {
    userPayload = await c.req.json();
  } catch (error) {
    userPayload = {}; // Default to empty object for empty/malformed JSON
  }

  // Create a new request for the new route structure
  const url = new URL(c.req.url);
  url.pathname = `/bubble-flow/${id}/execute`;

  const newRequest = new Request(url.toString(), {
    method: 'POST',
    headers: c.req.header(),
    body: JSON.stringify(userPayload), // Pass user payload directly
  });

  return app.fetch(newRequest);
});

// OpenAPI documentation endpoint
app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'BubbleLab API',
    description: 'API for BubbleLab',
  },
  servers: [
    {
      url: process.env.NODEX_API_URL || 'http://localhost:3001',
      description: 'BubbleLab API Server',
    },
  ],
});

// Swagger UI endpoint
app.get('/ui', swaggerUI({ url: '/doc' }));

const port = process.env.PORT || 3001;

// Run migrations before starting the server
try {
  await runMigrations();
  // Seed dev user after migrations (only in dev mode)
  await seedDevUser();
  // Eagerly initialize bubble factory before handling any requests or starting cron
  await getBubbleFactory();
} catch (error) {
  console.error('Failed to run migrations or seed dev user, exiting...');
  process.exit(1);
}

console.log(`Server is running on port ${port}`);

// Log initial memory usage
logMemoryUsage();

// Log memory usage every 30 seconds
// setInterval(logMemoryUsage, 30000);

// Print ip address
fetch('https://api.ipify.org?format=json')
  .then((response) => response.json())
  .then((data) => console.log('Current IP:', (data as { ip: string }).ip));

// Start cron scheduler (in-process)
startCronScheduler();

export default {
  port,
  fetch: app.fetch,
  // Configure timeout for streaming AI agent requests (max 255 seconds for Bun)
  idleTimeout: 255, // 4 minutes 15 seconds (maximum allowed by Bun)
  maxRequestBodySize: 20 * 1024 * 1024, // 20MB
};
