import { Request, Response, NextFunction } from 'express';
import { metrics, Counter, Histogram, ValueType } from '@opentelemetry/api';

const meter = metrics.getMeter('wellab-api', '1.0.0');

// --- Counters ---

export const apiRequestsTotal: Counter = meter.createCounter('api_requests_total', {
  description: 'Total number of API requests',
  unit: '1',
});

export const claudeApiCallsTotal: Counter = meter.createCounter('claude_api_calls_total', {
  description: 'Total number of Claude API calls',
  unit: '1',
});

export const emaObservationsTotal: Counter = meter.createCounter('ema_observations_total', {
  description: 'Total EMA observations recorded',
  unit: '1',
});

export const fairnessViolationsTotal: Counter = meter.createCounter('fairness_audit_violations_total', {
  description: 'Total fairness audit violations detected',
  unit: '1',
});

// --- Histograms ---

export const apiRequestDuration: Histogram = meter.createHistogram('api_request_duration_seconds', {
  description: 'API request duration in seconds',
  unit: 's',
  valueType: ValueType.DOUBLE,
});

export const mlInferenceDuration: Histogram = meter.createHistogram('ml_inference_duration_seconds', {
  description: 'ML model inference duration in seconds',
  unit: 's',
  valueType: ValueType.DOUBLE,
});

// --- Middleware ---

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;

    const route = req.route?.path || req.path;
    const method = req.method;
    const status = res.statusCode.toString();

    apiRequestsTotal.add(1, { method, route, status });
    apiRequestDuration.record(durationSec, { method, route, status });
  });

  next();
}
