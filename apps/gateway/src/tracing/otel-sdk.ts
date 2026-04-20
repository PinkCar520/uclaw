import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes, defaultResource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4318/v1/traces',
});

export const otelSDK = new NodeSDK({
  resource: defaultResource().merge(
    resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: 'uclaw-gateway',
    })
  ),
  traceExporter: exporter,
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new NestInstrumentation(),
  ],
});

// Start the SDK
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_TRACING === 'true') {
  console.log('[Tracing] Initializing OpenTelemetry SDK...');
  otelSDK.start();
}

// Gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  otelSDK.shutdown()
    .then(() => console.log('[Tracing] SDK shut down successfully'))
    .catch((err) => console.log('[Tracing] Error shutting down SDK', err))
    .finally(() => process.exit(0));
});
