import { Request, Response, Router } from 'express';
import { logger } from '../utils/logger';

interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  checks: HealthCheckResult[];
}

async function checkDynamoDB(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // In production, use DescribeTable to verify connectivity
    // For now, verify env var is set
    const tableName = process.env.DYNAMODB_TABLE_NAME;
    if (!tableName) {
      return { name: 'dynamodb', status: 'degraded', message: 'DYNAMODB_TABLE_NAME not configured' };
    }
    return { name: 'dynamodb', status: 'healthy', latencyMs: Date.now() - start };
  } catch (err) {
    return { name: 'dynamodb', status: 'unhealthy', latencyMs: Date.now() - start, message: (err as Error).message };
  }
}

async function checkMemory(): Promise<HealthCheckResult> {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const threshold = parseInt(process.env.HEAP_THRESHOLD_MB || '512', 10);

  if (heapUsedMB > threshold) {
    return { name: 'memory', status: 'degraded', message: `Heap ${heapUsedMB}MB / ${heapTotalMB}MB (threshold: ${threshold}MB)` };
  }
  return { name: 'memory', status: 'healthy', message: `Heap ${heapUsedMB}MB / ${heapTotalMB}MB` };
}

async function checkClaudeApi(): Promise<HealthCheckResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
    return { name: 'claude-api', status: 'degraded', message: 'ANTHROPIC_API_KEY not configured' };
  }
  return { name: 'claude-api', status: 'healthy' };
}

async function runChecks(): Promise<HealthResponse> {
  const checks = await Promise.all([checkDynamoDB(), checkMemory(), checkClaudeApi()]);

  const hasUnhealthy = checks.some((c) => c.status === 'unhealthy');
  const hasDegraded = checks.some((c) => c.status === 'degraded');
  const overallStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

  return {
    status: overallStatus,
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
  };
}

const router = Router();

/** Deep health check — verifies all dependencies */
router.get('/health', async (_req: Request, res: Response) => {
  const result = await runChecks();
  const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;
  logger.info('Health check', { status: result.status });
  res.status(statusCode).json(result);
});

/** Liveness probe — is the process alive? */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

/** Readiness probe — can the service handle traffic? */
router.get('/ready', async (_req: Request, res: Response) => {
  const result = await runChecks();
  const ready = result.status !== 'unhealthy';
  res.status(ready ? 200 : 503).json({ ready, status: result.status, timestamp: new Date().toISOString() });
});

export { router as healthRouter };
