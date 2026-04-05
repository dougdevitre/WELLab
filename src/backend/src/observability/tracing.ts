import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter, BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { logger } from '../utils/logger';

const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

let sdk: NodeSDK | null = null;

export function initTracing(): void {
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

  const resource = new Resource({
    'service.name': 'wellab-api',
    'service.version': '1.0.0',
    'deployment.environment': process.env.NODE_ENV || 'development',
  });

  const spanProcessor = isDev
    ? new SimpleSpanProcessor(new ConsoleSpanExporter())
    : new BatchSpanProcessor(new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }));

  sdk = new NodeSDK({
    resource,
    spanProcessors: [spanProcessor],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-aws-sdk': { enabled: true },
      }),
    ],
  });

  sdk.start();
  logger.info('OpenTelemetry tracing initialized', { endpoint: otlpEndpoint, env: process.env.NODE_ENV });
}

export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      logger.info('OpenTelemetry tracing shut down');
    } catch (err) {
      logger.error('Error shutting down tracing', { error: (err as Error).message });
    }
  }
}
