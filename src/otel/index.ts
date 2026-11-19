import { context, metrics, propagation, SpanKind, SpanStatusCode, trace, type Meter, type Tracer } from '@opentelemetry/api';
import type { OperationInfo, SpanHandle, Telemetry } from '../telemetry.js';

export interface OpenTelemetryOptions {
  /** Defaults to the global tracer provider. */
  tracer?: Tracer;
  /** Defaults to the global meter provider. */
  meter?: Meter;
  /** Add the principal id as `enduser.id`. Off by default because it is personal data in most deployments. */
  recordPrincipal?: boolean;
}

const methods = { tool: 'tools/call', resource: 'resources/read', prompt: 'prompts/get' } as const;

const metaGetter = {
  keys: (carrier: Record<string, unknown>) => Object.keys(carrier),
  get: (carrier: Record<string, unknown>, key: string) => {
    const value = carrier[key];
    return typeof value === 'string' ? value : undefined;
  },
};

/**
 * OpenTelemetry tracing and metrics using the MCP semantic conventions. Spans
 * continue the client's trace from the `traceparent` it sends in `_meta`, so
 * one trace covers the agent, the tool call and whatever the tool calls next.
 * Register your SDK (NodeSDK, a Workers exporter, Honeycomb, Datadog, Grafana)
 * as usual; this only creates the spans and instruments.
 */
export function openTelemetry(options: OpenTelemetryOptions = {}): Telemetry {
  const tracer = options.tracer ?? trace.getTracer('mcp-starter-kit');
  const meter = options.meter ?? metrics.getMeter('mcp-starter-kit');
  const duration = meter.createHistogram('mcp.server.operation.duration', {
    unit: 's',
    description: 'Duration of MCP tool calls, resource reads and prompt renders',
  });

  return {
    run<T>(info: OperationInfo, fn: (span: SpanHandle) => Promise<T>): Promise<T> {
      const parent = info.meta ? propagation.extract(context.active(), info.meta, metaGetter) : context.active();
      const method = methods[info.kind];
      const attributes: Record<string, string | number | boolean> = {
        'mcp.method.name': method,
        'mcp_starter_kit.request_id': info.requestId,
        'mcp_starter_kit.principal.kind': info.principal.kind,
      };
      if (info.kind === 'tool') {
        attributes['gen_ai.operation.name'] = 'execute_tool';
        attributes['gen_ai.tool.name'] = info.name;
      } else if (info.kind === 'resource') attributes['mcp.resource.uri'] = info.name;
      else attributes['gen_ai.prompt.name'] = info.name;
      if (info.principal.orgId) attributes['mcp_starter_kit.org_id'] = info.principal.orgId;
      if (options.recordPrincipal) attributes['enduser.id'] = info.principal.id;

      const started = performance.now();
      return tracer.startActiveSpan(`${method} ${info.name}`, { kind: SpanKind.SERVER, attributes }, parent, async (span) => {
        let failed: string | undefined;
        const handle: SpanHandle = {
          setAttributes: (attrs) => span.setAttributes(attrs),
          fail: (error, message) => {
            failed = message ?? (error instanceof Error ? error.name : 'error');
            if (error instanceof Error) span.recordException(error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: failed });
          },
        };
        try {
          return await fn(handle);
        } catch (error) {
          handle.fail(error);
          throw error;
        } finally {
          duration.record((performance.now() - started) / 1000, {
            'mcp.method.name': method,
            ...(info.kind === 'tool' ? { 'gen_ai.tool.name': info.name } : {}),
            ...(failed ? { 'error.type': failed } : {}),
          });
          span.end();
        }
      });
    },
  };
}
