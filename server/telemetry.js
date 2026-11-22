// OpenTelemetry metrics, pushed straight to Grafana Cloud over OTLP/HTTP (no agent needed).
// Enabled only when OTEL_EXPORTER_OTLP_ENDPOINT is set; otherwise every instrument below is a
// harmless no-op, so local development and CI work without Grafana credentials.
// The exporter reads the standard OTEL_EXPORTER_OTLP_* variables (endpoint, headers, protocol).
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { metrics, diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';

const enabled = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
let provider = null;

// The SDK swallows export errors by default. Set OTEL_LOG_LEVEL=error (or debug) to see them.
const logLevel = DiagLogLevel[(process.env.OTEL_LOG_LEVEL ?? '').toUpperCase()];
if (logLevel !== undefined) diag.setLogger(new DiagConsoleLogger(), logLevel);

if (enabled) {
  // Keep the interval >= 10s: the SDK clamps the export timeout to the interval, and a short
  // interval makes exports time out before Grafana Cloud answers.
  const interval = Math.max(10000, Number(process.env.OTEL_METRIC_EXPORT_INTERVAL ?? 30000));
  provider = new MeterProvider({
    resource: resourceFromAttributes({
      'service.name': process.env.OTEL_SERVICE_NAME || 'shopeasy',
      'deployment.environment.name': process.env.NODE_ENV || 'development',
    }),
    readers: [
      new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter(), exportIntervalMillis: interval }),
    ],
  });
  metrics.setGlobalMeterProvider(provider);
  console.log('Telemetry: exporting metrics to', process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
}

const meter = metrics.getMeter('shopeasy');

// Create a domain counter anywhere in the server, e.g.
//   export const refunds = counter('shopeasy.refunds', 'Refunds issued');  ...  refunds.add(1, { reason });
// Labels must be low-cardinality (a category or status, never a user id, email or raw URL).
export const counter = (name, description = '') => meter.createCounter(name, { description });

export const httpDuration = meter.createHistogram('http.server.request.duration', {
  description: 'Duration of HTTP requests',
  unit: 's',
  advice: { explicitBucketBoundaries: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] },
});

// Process health.
const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();
meter
  .createObservableGauge('nodejs.eventloop.delay.p99', { unit: 's', description: 'Event loop delay, p99' })
  .addCallback((r) => {
    r.observe(loopDelay.percentile(99) / 1e9);
    loopDelay.reset();
  });
meter
  .createObservableGauge('process.memory.rss', { unit: 'By', description: 'Resident set size' })
  .addCallback((r) => r.observe(process.memoryUsage().rss));
meter
  .createObservableGauge('process.memory.heap_used', { unit: 'By', description: 'V8 heap in use' })
  .addCallback((r) => r.observe(process.memoryUsage().heapUsed));

// Express middleware. Mount it BEFORE every route (right after app.disable('x-powered-by')) so auth
// and static requests are counted too. The route label is the route PATTERN ("/api/items/:id"),
// never the raw URL, to keep label cardinality low. Unmatched /api paths collapse to "/api/*".
export function httpMetrics(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route
      ? `${req.baseUrl ?? ''}${req.route.path}`
      : req.originalUrl.startsWith('/api')
        ? '/api/*'
        : 'static';
    httpDuration.record(seconds, {
      'http.request.method': req.method,
      'http.route': route,
      'http.response.status_code': res.statusCode,
    });
  });
  next();
}

// Flush the last batch of metrics before the process exits.
export async function shutdownTelemetry() {
  await provider?.shutdown().catch((err) => console.error('Telemetry shutdown failed:', err.message));
}
