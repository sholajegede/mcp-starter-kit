import type { Principal } from './types.js';

export interface SpanHandle {
  setAttributes(attributes: Record<string, string | number | boolean>): void;
  /** Mark the operation failed. `error` is recorded as an exception event. */
  fail(error: unknown, message?: string): void;
}

export interface OperationInfo {
  kind: 'tool' | 'resource' | 'prompt';
  /** Tool name, resource URI or prompt name. */
  name: string;
  principal: Principal;
  requestId: string;
  /** The request's `_meta`, which carries W3C trace context (`traceparent`, `tracestate`, `baggage`) from the client. */
  meta?: Record<string, unknown>;
}

/**
 * Wraps every tool call, resource read and prompt render. Implement it for
 * your tracing backend, or use `openTelemetry()` from `mcp-starter-kit/otel`.
 */
export interface Telemetry {
  run<T>(info: OperationInfo, fn: (span: SpanHandle) => Promise<T>): Promise<T>;
}

const noopSpan: SpanHandle = { setAttributes() {}, fail() {} };

export const noTelemetry: Telemetry = {
  run: (_info, fn) => fn(noopSpan),
};
