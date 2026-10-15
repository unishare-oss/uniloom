// Run with Bun in a fresh process: bun apps/api/scripts/check-telemetry.ts.
// Exercises the actual SDK and native fetch without a database or cluster.
import assert from 'node:assert/strict';

type ExportedSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  status: { code?: number };
};
type ExportBatch = {
  resourceSpans: { scopeSpans: { spans: ExportedSpan[] }[] }[];
};
const batches: ExportBatch[] = [];
const collector = Bun.serve({
  port: 0,
  fetch: async (request) => {
    batches.push((await request.json()) as ExportBatch);
    return Response.json({});
  },
});
const downstream = Bun.serve({
  port: 0,
  fetch: async (request) => {
    await Bun.sleep(5);
    return Response.json(
      {
        traceparent: request.headers.get('traceparent'),
        custom: request.headers.get('x-check'),
        body: await request.text(),
      },
      { status: 503 },
    );
  },
});
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = collector.url
  .toString()
  .replace(/\/$/, '');
process.env.OTEL_SERVICE_NAME = 'telemetry-check';
process.env.OTEL_TRACES_SAMPLER = 'always_on';
process.env.OTEL_SDK_DISABLED = 'false';
const originalPreconnect = fetch.preconnect;
const { telemetry } = await import('../src/telemetry.js');
const { trace } = await import('@opentelemetry/api');
assert.ok(telemetry);
assert.equal(fetch.preconnect, originalPreconnect);
try {
  const roots = await Promise.all(
    [1, 2, 3].map(async (id) =>
      trace
        .getTracer('telemetry-check')
        .startActiveSpan(`request-${id}`, async (span) => {
          try {
            const request = new Request(downstream.url.toString(), {
              method: 'POST',
              headers: { 'x-check': String(id) },
              body: `body-${id}`,
            });
            const response = await fetch(request);
            const body = (await response.json()) as {
              traceparent: string;
              custom: string;
              body: string;
            };
            assert.equal(response.status, 503);
            assert.equal(body.custom, String(id));
            assert.equal(body.body, `body-${id}`);
            assert.equal(
              body.traceparent.split('-')[1],
              span.spanContext().traceId,
            );
            assert.notEqual(
              body.traceparent.split('-')[2],
              span.spanContext().spanId,
            );
            return {
              ...span.spanContext(),
              childId: body.traceparent.split('-')[2],
            };
          } finally {
            span.end();
          }
        }),
    ),
  );
  assert.equal(new Set(roots.map((root) => root.traceId)).size, 3);
  const { Hono } = await import('hono');
  const { httpInstrumentationMiddleware } = await import('@hono/otel');
  const app = new Hono();
  app.use('*', httpInstrumentationMiddleware());
  app.post('/items/:id', async (c) => {
    await fetch(downstream.url);
    return c.text('failure', 500);
  });
  const incomingTraceId = '12345678901234567890123456789012';
  const incomingSpanId = '1234567890123456';
  const response = await app.request('/items/private-id', {
    method: 'POST',
    headers: { traceparent: `00-${incomingTraceId}-${incomingSpanId}-01` },
  });
  assert.equal(response.status, 500);
  // Flush while the fake collector is still listening.
  await telemetry.shutdown();
  const spans = batches.flatMap((batch) =>
    batch.resourceSpans.flatMap((resource) =>
      resource.scopeSpans.flatMap((scope) => scope.spans),
    ),
  );
  assert.equal(
    spans.length,
    8,
    'three operations, one incoming request and four outgoing calls; no exporter recursion',
  );
  for (const root of roots) {
    const child = spans.find((span) => span.spanId === root.childId);
    assert.ok(child);
    assert.equal(child.traceId, root.traceId);
    assert.equal(child.parentSpanId, root.spanId);
    assert.equal(
      child.status.code,
      2,
      '503 must mark the client span as an error',
    );
  }
  const incoming = spans.find((span) => span.parentSpanId === incomingSpanId);
  assert.ok(incoming);
  assert.equal(incoming.traceId, incomingTraceId);
  assert.equal(incoming.name, 'POST /items/:id');
  assert.equal(incoming.status.code, 2);
  assert.ok(
    spans.some(
      (span) =>
        span.parentSpanId === incoming.spanId &&
        span.traceId === incomingTraceId,
    ),
  );
  console.log(
    'PASS: concurrent trace context, parent links, POST body/headers, error status, export and fetch properties',
  );
} finally {
  await collector.stop(true);
  await downstream.stop(true);
}
