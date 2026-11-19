import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { afterAll, describe, expect, it } from 'vitest';
import { defineServer, defineTool, ToolError } from '../src/index.js';
import { openTelemetry } from '../src/otel/index.js';
import { connect, text } from './helpers.js';

describe('openTelemetry', () => {
  const spans = new InMemorySpanExporter();
  const tracerProvider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(spans)] });
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 60_000 });
  const meterProvider = new MeterProvider({ readers: [reader] });
  afterAll(() => trace.disable());

  const server = defineServer({
    name: 'traced',
    version: '1.0.0',
    allowAnonymous: true,
    logLevel: 'silent',
    telemetry: openTelemetry({ tracer: tracerProvider.getTracer('test'), meter: meterProvider.getMeter('test') }),
    tools: [
      defineTool({ name: 'ok_tool', description: 'Works', handler: () => 'fine' }),
      defineTool({ name: 'bad_tool', description: 'Fails', handler: () => { throw new ToolError('nope'); } }),
    ],
  });

  it('creates a server span per call that continues the client trace', async () => {
    const client = await connect(server);
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    await client.callTool({ name: 'ok_tool', arguments: {}, _meta: { traceparent: `00-${traceId}-00f067aa0ba902b7-01` } });
    expect(text(await client.callTool({ name: 'bad_tool', arguments: {} }))).toBe('nope');

    const [ok, bad] = spans.getFinishedSpans();
    expect(ok!.name).toBe('tools/call ok_tool');
    expect(ok!.spanContext().traceId).toBe(traceId);
    expect(ok!.attributes).toMatchObject({ 'mcp.method.name': 'tools/call', 'gen_ai.tool.name': 'ok_tool', 'gen_ai.operation.name': 'execute_tool', 'mcp_starter_kit.outcome': 'ok' });
    expect(bad!.status.code).toBe(2);
    expect(bad!.attributes['mcp_starter_kit.outcome']).toBe('tool_error');

    await reader.forceFlush();
    const names = metricExporter.getMetrics().flatMap((m) => m.scopeMetrics.flatMap((s) => s.metrics.map((x) => x.descriptor.name)));
    expect(names).toContain('mcp.server.operation.duration');
  });
});
