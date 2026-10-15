import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
export const telemetry =
  endpoint && process.env.OTEL_SDK_DISABLED !== 'true'
    ? new NodeSDK({
        serviceName: process.env.OTEL_SERVICE_NAME ?? 'uniloom-api',
        traceExporter: new OTLPTraceExporter(),
        metricReaders: [],
        logRecordProcessors: [],
      })
    : undefined;
telemetry?.start();

// Bun's native fetch does not go through Node's http/undici instrumentation.
// Preserve fetch's own properties (including Bun.preconnect) and Request options.
// Only trace calls inside an active operation, and never trace the exporter.
if (telemetry) {
  const tracer = trace.getTracer('unicorp.fetch');
  globalThis.fetch = new Proxy(globalThis.fetch, {
    apply: async (target, thisArg, args: Parameters<typeof fetch>) => {
      const [input, init] = args;
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (!trace.getSpan(context.active()) || url.href.startsWith(endpoint!)) {
        return Reflect.apply(target, thisArg, args);
      }
      const method =
        init?.method ?? (input instanceof Request ? input.method : 'GET');
      return tracer.startActiveSpan(
        `HTTP ${method}`,
        {
          kind: SpanKind.CLIENT,
          attributes: {
            'http.request.method': method,
            'server.address': url.hostname,
          },
        },
        async (span) => {
          try {
            const headers = new Headers(
              init?.headers ??
                (input instanceof Request ? input.headers : undefined),
            );
            const carrier: Record<string, string> = {};
            propagation.inject(context.active(), carrier);
            for (const [key, value] of Object.entries(carrier))
              headers.set(key, value);
            const response: Response = await Reflect.apply(target, thisArg, [
              input,
              { ...init, headers },
            ]);
            span.setAttribute('http.response.status_code', response.status);
            if (response.status >= 400)
              span.setStatus({ code: SpanStatusCode.ERROR });
            return response;
          } catch (error) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            if (error instanceof Error) span.recordException(error);
            throw error;
          } finally {
            span.end();
          }
        },
      );
    },
  });
}
